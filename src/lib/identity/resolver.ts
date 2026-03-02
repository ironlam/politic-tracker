import { db } from "@/lib/db";
import { Judgement, MatchMethod, Prisma } from "@/generated/prisma";
import { normalizeText } from "@/lib/name-matching";
import {
  ResolveInput,
  ResolveResult,
  CandidateMatch,
  ScoringInput,
  CachedPolitician,
  BatchResolveInput,
  BatchResolveResult,
  IDENTITY_THRESHOLDS,
  BIRTHDATE_TOLERANCE_MS,
} from "./types";

/**
 * Pure scoring function — no DB, no side effects.
 * Shared between resolve() (single) and resolveBatch() (bulk).
 */
export function scoreCandidate(
  input: ScoringInput,
  candidate: CachedPolitician,
  blockedIds: Set<string>
): CandidateMatch {
  const isBlocked = blockedIds.has(candidate.id);
  let score = 0.5;
  let method: MatchMethod = MatchMethod.NAME_ONLY;

  if (input.birthDate && candidate.birthDate) {
    const diff = Math.abs(candidate.birthDate.getTime() - input.birthDate.getTime());
    if (diff <= BIRTHDATE_TOLERANCE_MS) {
      score = 0.9;
      method = MatchMethod.BIRTHDATE;
    } else {
      score = 0.1;
    }
  }

  if (input.department && candidate.departments.includes(input.department) && score < 0.7) {
    score = 0.7;
    method = MatchMethod.DEPARTMENT;
  }

  return {
    politicianId: candidate.id,
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    birthDate: candidate.birthDate,
    score,
    method,
    blocked: isBlocked,
  };
}

/**
 * Bulk identity resolver — pre-loads data into memory for O(1) screening.
 * Use for syncs with 1000+ records. Same scoring logic as resolve().
 */
export async function resolveBatch(batchInput: BatchResolveInput): Promise<BatchResolveResult> {
  const { inputs, sourceType, onProgress } = batchInput;

  if (inputs.length === 0) {
    return {
      results: [],
      stats: { total: 0, matched: 0, review: 0, notFound: 0, blocked: 0 },
    };
  }

  // ── Phase A: Preload all politicians + decisions in 2 parallel queries ──
  const [allPoliticians, allDecisions] = await Promise.all([
    db.politician.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        mandates: {
          where: { departmentCode: { not: null } },
          select: { departmentCode: true },
        },
      },
    }),
    db.identityDecision.findMany({
      where: { sourceType, supersededBy: null },
      orderBy: { decidedAt: "desc" },
    }),
  ]);

  // Build politician lookup: normalizedLastName → CachedPolitician[]
  const politicianMap = new Map<string, CachedPolitician[]>();
  for (const p of allPoliticians) {
    const key = normalizeText(p.lastName);
    const cached: CachedPolitician = {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      birthDate: p.birthDate,
      departments: p.mandates.map((m) => m.departmentCode).filter((d): d is string => d !== null),
    };
    const existing = politicianMap.get(key);
    if (existing) existing.push(cached);
    else politicianMap.set(key, [cached]);
  }

  // Build decision lookup: sourceId → Decision[]
  const decisionMap = new Map<string, typeof allDecisions>();
  for (const d of allDecisions) {
    const existing = decisionMap.get(d.sourceId);
    if (existing) existing.push(d);
    else decisionMap.set(d.sourceId, [d]);
  }

  // ── Phase B: Screen + Score (pure memory, 0 DB queries) ──
  const results: ResolveResult[] = [];
  const stats = { total: inputs.length, matched: 0, review: 0, notFound: 0, blocked: 0 };
  const decisionsToCreate: {
    sourceType: typeof sourceType;
    sourceId: string;
    politicianId: string;
    judgement: Judgement;
    confidence: number;
    method: MatchMethod;
    evidence: Prisma.InputJsonValue;
    decidedBy: string;
  }[] = [];

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i]!;

    // Lookup candidates by normalized lastName
    const key = normalizeText(input.lastName);
    const candidates = politicianMap.get(key);

    if (!candidates || candidates.length === 0) {
      stats.notFound++;
      if (onProgress && (i + 1) % 10000 === 0) onProgress(i + 1, inputs.length);
      continue;
    }

    // Check prior decisions for this sourceId
    const priorDecisions = decisionMap.get(input.sourceId) ?? [];
    const blockedIds = new Set(
      priorDecisions.filter((d) => d.judgement === Judgement.NOT_SAME).map((d) => d.politicianId)
    );

    // Check for high-confidence SAME decision → shortcircuit
    const confirmedSame = priorDecisions.find(
      (d) => d.judgement === Judgement.SAME && d.confidence >= IDENTITY_THRESHOLDS.AUTO_MATCH
    );
    if (confirmedSame) {
      stats.matched++;
      results.push({
        politicianId: confirmedSame.politicianId,
        confidence: confirmedSame.confidence,
        method: confirmedSame.method,
        decision: Judgement.SAME,
        candidates: [],
        blocked: false,
      });
      if (onProgress && (i + 1) % 10000 === 0) onProgress(i + 1, inputs.length);
      continue;
    }

    // Score all candidates
    const scored: CandidateMatch[] = candidates.map((c) => scoreCandidate(input, c, blockedIds));

    // Sort by score descending, filter blocked
    const activeCandidates = scored.filter((c) => !c.blocked).sort((a, b) => b.score - a.score);

    const allBlocked = scored.length > 0 && activeCandidates.length === 0;
    const bestMatch = activeCandidates[0];

    if (allBlocked) {
      stats.blocked++;
      if (onProgress && (i + 1) % 10000 === 0) onProgress(i + 1, inputs.length);
      continue;
    }

    if (!bestMatch || bestMatch.score < IDENTITY_THRESHOLDS.REVIEW) {
      stats.notFound++;
      if (onProgress && (i + 1) % 10000 === 0) onProgress(i + 1, inputs.length);
      continue;
    }

    // Determine judgement
    let judgement: Judgement;
    if (bestMatch.score >= IDENTITY_THRESHOLDS.AUTO_MATCH) {
      judgement = Judgement.SAME;
      stats.matched++;
    } else {
      judgement = Judgement.UNDECIDED;
      stats.review++;
    }

    results.push({
      politicianId: bestMatch.politicianId,
      confidence: bestMatch.score,
      method: bestMatch.method,
      decision: judgement,
      candidates: scored,
      blocked: false,
    });

    // Accumulate decision to persist
    decisionsToCreate.push({
      sourceType,
      sourceId: input.sourceId,
      politicianId: bestMatch.politicianId,
      judgement,
      confidence: bestMatch.score,
      method: bestMatch.method,
      evidence: JSON.parse(
        JSON.stringify({
          firstName: input.firstName,
          lastName: input.lastName,
          birthDate: input.birthDate?.toISOString() ?? null,
          department: input.department ?? null,
          candidateCount: scored.length,
          context: input.context ?? null,
        })
      ) as Prisma.InputJsonValue,
      decidedBy: `system:sync-${input.source.toLowerCase()}`,
    });

    if (onProgress && (i + 1) % 10000 === 0) onProgress(i + 1, inputs.length);
  }

  // ── Phase C: Persist (batch writes in chunks of 100) ──
  const CHUNK_SIZE = 100;
  for (let i = 0; i < decisionsToCreate.length; i += CHUNK_SIZE) {
    const chunk = decisionsToCreate.slice(i, i + CHUNK_SIZE);
    let persisted = false;

    // Try batch transaction if available
    if (typeof db.$transaction === "function") {
      try {
        await db.$transaction(chunk.map((d) => db.identityDecision.create({ data: d })));
        persisted = true;
      } catch {
        // Fall through to individual creates
      }
    }

    // Fallback: individual creates
    if (!persisted) {
      for (const d of chunk) {
        try {
          await db.identityDecision.create({ data: d });
        } catch {
          console.error(
            `[resolveBatch] Failed to persist decision for ${d.sourceType}:${d.sourceId}`
          );
        }
      }
    }
  }

  // Final progress callback
  if (onProgress) onProgress(inputs.length, inputs.length);

  return { results, stats };
}

/**
 * Unified identity resolver — replaces per-sync matching logic.
 *
 * Pipeline:
 * 1. Check prior IdentityDecisions (NOT_SAME blocks, SAME auto-matches)
 * 2. Deterministic match via shared ExternalId
 * 3. Birthdate match (name + birthdate ±1 day)
 * 4. Department match (name + existing mandate in same dept)
 * 5. Name-only scoring (lowest confidence)
 * 6. Threshold decision (auto-match / review / reject)
 * 7. Log decision to IdentityDecision table
 */
export async function resolve(input: ResolveInput): Promise<ResolveResult> {
  const { firstName, lastName, source, sourceId } = input;

  // ── Step 1: Check prior decisions ──────────────────────────────
  const priorDecisions = await db.identityDecision.findMany({
    where: {
      sourceType: source,
      sourceId,
      supersededBy: null, // only active decisions
    },
    orderBy: { decidedAt: "desc" },
  });

  const blockedIds = new Set(
    priorDecisions.filter((d) => d.judgement === Judgement.NOT_SAME).map((d) => d.politicianId)
  );

  // If there's a high-confidence SAME decision, return immediately
  const confirmedSame = priorDecisions.find(
    (d) => d.judgement === Judgement.SAME && d.confidence >= IDENTITY_THRESHOLDS.AUTO_MATCH
  );
  if (confirmedSame) {
    return {
      politicianId: confirmedSame.politicianId,
      confidence: confirmedSame.confidence,
      method: confirmedSame.method,
      decision: Judgement.SAME,
      candidates: [],
      blocked: false,
    };
  }

  // ── Step 2: Deterministic match via ExternalId ─────────────────
  const existingLink = await db.externalId.findFirst({
    where: { source, externalId: sourceId, politicianId: { not: null } },
    select: { politicianId: true },
  });

  if (existingLink?.politicianId && !blockedIds.has(existingLink.politicianId)) {
    const result: ResolveResult = {
      politicianId: existingLink.politicianId,
      confidence: 1.0,
      method: MatchMethod.EXTERNAL_ID,
      decision: Judgement.SAME,
      candidates: [],
      blocked: false,
    };
    await logDecision(input, result);
    return result;
  }

  // ── Steps 3-5: Candidate matching ─────────────────────────────
  const nameCandidates = await db.politician.findMany({
    where: {
      firstName: { equals: firstName, mode: "insensitive" },
      lastName: { equals: lastName, mode: "insensitive" },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      mandates: {
        where: { departmentCode: { not: null } },
        select: { departmentCode: true },
      },
    },
  });

  const candidates: CandidateMatch[] = nameCandidates.map((p) => {
    const cached: CachedPolitician = {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      birthDate: p.birthDate,
      departments: p.mandates.map((m) => m.departmentCode).filter((d): d is string => d !== null),
    };
    return scoreCandidate(input, cached, blockedIds);
  });

  // Sort by score descending, filter blocked
  const activeCandidates = candidates.filter((c) => !c.blocked).sort((a, b) => b.score - a.score);

  // ── Step 6: Threshold decision ─────────────────────────────────
  const allBlocked = candidates.length > 0 && activeCandidates.length === 0;
  const bestMatch = activeCandidates[0];

  let result: ResolveResult;

  if (!bestMatch || bestMatch.score < IDENTITY_THRESHOLDS.REVIEW) {
    result = {
      politicianId: null,
      confidence: bestMatch?.score ?? 0,
      method: bestMatch?.method ?? MatchMethod.NAME_ONLY,
      decision: "NEW",
      candidates,
      blocked: allBlocked,
    };
  } else if (bestMatch.score >= IDENTITY_THRESHOLDS.AUTO_MATCH) {
    result = {
      politicianId: bestMatch.politicianId,
      confidence: bestMatch.score,
      method: bestMatch.method,
      decision: Judgement.SAME,
      candidates,
      blocked: false,
    };
  } else {
    // Review zone: 0.70–0.94
    result = {
      politicianId: bestMatch.politicianId,
      confidence: bestMatch.score,
      method: bestMatch.method,
      decision: Judgement.UNDECIDED,
      candidates,
      blocked: false,
    };
  }

  // ── Step 7: Log decision ───────────────────────────────────────
  await logDecision(input, result);

  return result;
}

async function logDecision(input: ResolveInput, result: ResolveResult): Promise<void> {
  if (!result.politicianId && result.decision === "NEW") return;

  const politicianId = result.politicianId;
  if (!politicianId) return;

  try {
    await db.identityDecision.create({
      data: {
        sourceType: input.source,
        sourceId: input.sourceId,
        politicianId,
        judgement: result.decision === "NEW" ? Judgement.UNDECIDED : (result.decision as Judgement),
        confidence: result.confidence,
        method: result.method,
        evidence: {
          firstName: input.firstName,
          lastName: input.lastName,
          birthDate: input.birthDate?.toISOString() ?? null,
          department: input.department ?? null,
          candidateCount: result.candidates.length,
          context: input.context
            ? (JSON.parse(JSON.stringify(input.context)) as Prisma.InputJsonValue)
            : null,
        },
        decidedBy: `system:sync-${input.source.toLowerCase()}`,
      },
    });
  } catch {
    // Non-blocking: don't let logging failure break the sync
    console.error(
      `[IdentityResolver] Failed to log decision for ${input.source}:${input.sourceId}`
    );
  }
}
