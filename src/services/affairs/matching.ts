/**
 * Affair Matching Service
 *
 * Multi-criteria deduplication for judicial affairs from multiple sources.
 * Matches affairs by judicial identifiers (ECLI, pourvoi number, case numbers)
 * and falls back to fuzzy title matching when identifiers are unavailable.
 */

import { db } from "@/lib/db";
import type { AffairCategory } from "@/generated/prisma";

export type MatchConfidence = "CERTAIN" | "HIGH" | "POSSIBLE";

export interface MatchResult {
  affairId: string;
  confidence: MatchConfidence;
  score: number;
  matchedBy: string;
}

export interface MatchCandidate {
  politicianId: string;
  title: string;
  ecli?: string | null;
  pourvoiNumber?: string | null;
  caseNumbers?: string[];
  category?: AffairCategory;
  verdictDate?: Date | null;
}

/**
 * Normalize affair title for deduplication.
 * Strips common prefixes like "[À VÉRIFIER]" and normalizes whitespace.
 */
function normalizeAffairTitle(title: string): string {
  return title
    .replace(/^\[À VÉRIFIER\]\s*/i, "")
    .trim()
    .toLowerCase();
}

/**
 * Find existing affairs that match a candidate affair.
 * Returns matches ordered by confidence score (highest first).
 */
export async function findMatchingAffairs(candidate: MatchCandidate): Promise<MatchResult[]> {
  const matches: MatchResult[] = [];

  // Priority 1: ECLI (unique European identifier) — CERTAIN match
  if (candidate.ecli) {
    const ecliMatch = await db.affair.findUnique({
      where: { ecli: candidate.ecli },
      select: { id: true },
    });
    if (ecliMatch) {
      matches.push({
        affairId: ecliMatch.id,
        confidence: "CERTAIN",
        score: 1.0,
        matchedBy: "ecli",
      });
      return matches; // ECLI is definitive, no need to check further
    }
  }

  // Priority 2: Pourvoi number + same politician — HIGH confidence
  if (candidate.pourvoiNumber) {
    const pourvoiMatches = await db.affair.findMany({
      where: {
        pourvoiNumber: candidate.pourvoiNumber,
        politicianId: candidate.politicianId,
      },
      select: { id: true },
    });
    for (const match of pourvoiMatches) {
      matches.push({
        affairId: match.id,
        confidence: "HIGH",
        score: 0.95,
        matchedBy: "pourvoiNumber",
      });
    }
  }

  // Priority 3: Case numbers intersection + same politician — HIGH confidence
  if (candidate.caseNumbers && candidate.caseNumbers.length > 0) {
    const caseNumberMatches = await db.affair.findMany({
      where: {
        politicianId: candidate.politicianId,
        caseNumbers: { hasSome: candidate.caseNumbers },
      },
      select: { id: true },
    });
    for (const match of caseNumberMatches) {
      // Avoid duplicating matches already found by pourvoi
      if (!matches.some((m) => m.affairId === match.id)) {
        matches.push({
          affairId: match.id,
          confidence: "HIGH",
          score: 0.8,
          matchedBy: "caseNumbers",
        });
      }
    }
  }

  // Priority 4: Normalized title matching — bidirectional
  // Strips "[À VÉRIFIER]" prefix and compares both directions to catch
  // duplicates from successive import waves with slightly different formats.
  if (candidate.title) {
    const normalizedCandidate = normalizeAffairTitle(candidate.title);

    const samePoliticianAffairs = await db.affair.findMany({
      where: { politicianId: candidate.politicianId },
      select: { id: true, title: true, category: true },
    });

    for (const existing of samePoliticianAffairs) {
      if (matches.some((m) => m.affairId === existing.id)) continue;

      const normalizedExisting = normalizeAffairTitle(existing.title);

      // Exact normalized title → HIGH
      if (normalizedExisting === normalizedCandidate) {
        matches.push({
          affairId: existing.id,
          confidence: "HIGH",
          score: 0.85,
          matchedBy: "title-exact",
        });
        continue;
      }

      // One contains the other (bidirectional) → HIGH if same category, POSSIBLE otherwise
      const aContainsB = normalizedExisting.includes(normalizedCandidate);
      const bContainsA = normalizedCandidate.includes(normalizedExisting);

      if (aContainsB || bContainsA) {
        const sameCategory = candidate.category && existing.category === candidate.category;
        matches.push({
          affairId: existing.id,
          confidence: sameCategory ? "HIGH" : "POSSIBLE",
          score: sameCategory ? 0.75 : 0.5,
          matchedBy: sameCategory ? "title+category" : "title-partial",
        });
      }
    }
  }

  // Priority 5: Same politician + category + date ±30 days — POSSIBLE
  if (candidate.category && candidate.verdictDate) {
    const dateMin = new Date(candidate.verdictDate);
    dateMin.setDate(dateMin.getDate() - 30);
    const dateMax = new Date(candidate.verdictDate);
    dateMax.setDate(dateMax.getDate() + 30);

    const categoryDateMatches = await db.affair.findMany({
      where: {
        politicianId: candidate.politicianId,
        category: candidate.category,
        verdictDate: { gte: dateMin, lte: dateMax },
      },
      select: { id: true },
    });
    for (const match of categoryDateMatches) {
      if (!matches.some((m) => m.affairId === match.id)) {
        matches.push({
          affairId: match.id,
          confidence: "POSSIBLE",
          score: 0.4,
          matchedBy: "category+date",
        });
      }
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);
  return matches;
}

/**
 * Check if a candidate affair is a duplicate of an existing one.
 * Returns true if any match has HIGH or CERTAIN confidence.
 */
export async function isDuplicate(candidate: MatchCandidate): Promise<boolean> {
  const matches = await findMatchingAffairs(candidate);
  return matches.some((m) => m.confidence === "CERTAIN" || m.confidence === "HIGH");
}
