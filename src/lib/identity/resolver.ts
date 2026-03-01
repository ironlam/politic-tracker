import { db } from "@/lib/db";
import { Judgement, MatchMethod, Prisma } from "@/generated/prisma";
import {
  ResolveInput,
  ResolveResult,
  CandidateMatch,
  IDENTITY_THRESHOLDS,
  BIRTHDATE_TOLERANCE_MS,
} from "./types";

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
  const { firstName, lastName, birthDate, source, sourceId, department } = input;

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

  // Score each candidate based on available signals
  const candidates: CandidateMatch[] = nameCandidates.map((p) => {
    const isBlocked = blockedIds.has(p.id);
    const depts = new Set(
      p.mandates.map((m) => m.departmentCode).filter((d): d is string => d !== null)
    );

    let score = 0.5; // Base: name match only
    let method: MatchMethod = MatchMethod.NAME_ONLY;

    // Birthdate match: strong signal
    if (birthDate && p.birthDate) {
      const diff = Math.abs(p.birthDate.getTime() - birthDate.getTime());
      if (diff <= BIRTHDATE_TOLERANCE_MS) {
        score = 0.9;
        method = MatchMethod.BIRTHDATE;
      } else {
        // Birthdate mismatch: very likely different person
        score = 0.1;
      }
    }

    // Department match: medium signal (only upgrade if not already higher)
    if (department && depts.has(department) && score < 0.7) {
      score = 0.7;
      method = MatchMethod.DEPARTMENT;
    }

    return {
      politicianId: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      birthDate: p.birthDate,
      score,
      method,
      blocked: isBlocked,
    };
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
