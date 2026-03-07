import type { MandateType } from "@/generated/prisma";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal candidate shape needed for diversity scoring */
export interface DiversityCandidate {
  id: string;
  civility: string | null;
  prominenceScore: number;
  currentPartyId: string | null;
  mandates: {
    type: MandateType;
    departmentCode: string | null;
  }[];
}

/** A recent pick from NewsletterEdition with the data we need for comparison */
export interface RecentPick {
  partyId: string | null;
  departmentCode: string | null;
  civility: string | null;
  chamber: string | null;
}

// ---------------------------------------------------------------------------
// Chamber mapping
// ---------------------------------------------------------------------------

const CHAMBER_MAP: Record<string, string> = {
  DEPUTE: "AN",
  SENATEUR: "SENAT",
  DEPUTE_EUROPEEN: "EU",
};

function mandateTypeToChamber(type: MandateType): string {
  return CHAMBER_MAP[type] ?? "other";
}

/** Derive the primary chamber from a candidate's current mandates */
function primaryChamber(mandates: { type: MandateType }[]): string | null {
  if (mandates.length === 0) return null;
  // Prefer parliamentary mandates over "other"
  const chambers = mandates.map((m) => mandateTypeToChamber(m.type));
  return chambers.find((c) => c !== "other") ?? chambers[0] ?? null;
}

/** Derive the primary department from a candidate's current mandates */
function primaryDepartment(mandates: { departmentCode: string | null }[]): string | null {
  return mandates.find((m) => m.departmentCode)?.departmentCode ?? null;
}

// ---------------------------------------------------------------------------
// Diversity scoring (pure function — exported for testing)
// ---------------------------------------------------------------------------

/**
 * Score a candidate for diversity compared to recent newsletter picks.
 *
 * Scoring rules:
 *  - Party different from last 3 picks  → +3
 *  - Department different from last 3   → +2
 *  - Gender different from last pick     → +2
 *  - Chamber different from last pick    → +1
 *  - Prominence bonus                    → prominenceScore / 1000 (0..1)
 */
export function scoreDiversity(candidate: DiversityCandidate, recentHistory: RecentPick[]): number {
  let score = 0;

  const candidatePartyId = candidate.currentPartyId;
  const candidateDept = primaryDepartment(candidate.mandates);
  const candidateChamber = primaryChamber(candidate.mandates);

  // --- Party diversity (compare to last 3) ---
  const last3Parties = recentHistory.slice(0, 3).map((p) => p.partyId);
  if (last3Parties.length === 0 || !last3Parties.includes(candidatePartyId)) {
    score += 3;
  }

  // --- Department diversity (compare to last 3) ---
  const last3Depts = recentHistory.slice(0, 3).map((p) => p.departmentCode);
  if (last3Depts.length === 0 || !last3Depts.includes(candidateDept)) {
    score += 2;
  }

  // --- Gender diversity (compare to last pick) ---
  const lastCivility = recentHistory[0]?.civility ?? null;
  if (lastCivility === null || candidate.civility !== lastCivility) {
    score += 2;
  }

  // --- Chamber diversity (compare to last pick) ---
  const lastChamber = recentHistory[0]?.chamber ?? null;
  if (lastChamber === null || candidateChamber !== lastChamber) {
    score += 1;
  }

  // --- Prominence bonus (0..1) ---
  score += candidate.prominenceScore / 1000;

  return score;
}

// ---------------------------------------------------------------------------
// Main selection function
// ---------------------------------------------------------------------------

/**
 * Select the "politician of the week" for the newsletter.
 *
 * 1. Fetch last 10 editions to know recent picks
 * 2. Load PUBLISHED candidates with an active mandate, excluding recent picks
 * 3. Score each for diversity
 * 4. Randomly pick from the top 5 scorers
 *
 * Returns the politician ID, or null if no candidates are available.
 */
export async function selectPoliticianOfWeek(): Promise<string | null> {
  const { db } = await import("@/lib/db");

  // 1. Fetch recent editions with politician details
  const recentEditions = await db.newsletterEdition.findMany({
    orderBy: { weekStart: "desc" },
    take: 10,
    include: {
      politician: {
        select: {
          id: true,
          civility: true,
          currentPartyId: true,
          mandates: {
            where: { isCurrent: true },
            select: { type: true, departmentCode: true },
          },
        },
      },
    },
  });

  // Build recent history for scoring
  const recentPoliticianIds = recentEditions.map((e) => e.politicianId);
  const recentHistory: RecentPick[] = recentEditions.map((e) => ({
    partyId: e.politician.currentPartyId,
    departmentCode: primaryDepartment(e.politician.mandates),
    civility: e.politician.civility,
    chamber: primaryChamber(e.politician.mandates),
  }));

  // 2. Load candidates: PUBLISHED + active mandate, excluding recent picks
  const candidates = await db.politician.findMany({
    where: {
      publicationStatus: "PUBLISHED",
      mandates: { some: { isCurrent: true } },
      ...(recentPoliticianIds.length > 0 ? { id: { notIn: recentPoliticianIds } } : {}),
    },
    select: {
      id: true,
      civility: true,
      prominenceScore: true,
      currentPartyId: true,
      mandates: {
        where: { isCurrent: true },
        select: { type: true, departmentCode: true },
      },
    },
  });

  if (candidates.length === 0) return null;

  // 3. Score each candidate
  const scored = candidates.map((c) => ({
    id: c.id,
    score: scoreDiversity(c, recentHistory),
  }));

  // 4. Sort by score DESC, pick randomly from top 5
  scored.sort((a, b) => b.score - a.score);
  const topN = scored.slice(0, Math.min(5, scored.length));
  const winner = topN[Math.floor(Math.random() * topN.length)];

  return winner?.id ?? null;
}
