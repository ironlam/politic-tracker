import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/lib/api/with-admin-auth";

// Common French stopwords to ignore in title comparison
const STOPWORDS = new Set([
  "de",
  "du",
  "des",
  "le",
  "la",
  "les",
  "un",
  "une",
  "et",
  "en",
  "au",
  "aux",
  "pour",
  "par",
  "sur",
  "dans",
  "avec",
  "son",
  "sa",
  "ses",
  "ce",
  "cette",
  "qui",
  "que",
  "est",
  "a",
  "d",
  "l",
]);

function normalizeTitle(title: string): string[] {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

interface AffairForComparison {
  id: string;
  title: string;
  status: string;
  category: string;
  involvement: string;
  publicationStatus: string;
  ecli: string | null;
  pourvoiNumber: string | null;
  caseNumbers: string[];
  factsDate: Date | null;
  startDate: Date | null;
  verdictDate: Date | null;
  description: string;
  sources: { url: string; title: string; publisher: string }[];
  _count: { sources: number };
}

export interface DuplicateGroup {
  score: number;
  reasons: string[];
  affairs: {
    id: string;
    title: string;
    status: string;
    category: string;
    involvement: string;
    publicationStatus: string;
    ecli: string | null;
    pourvoiNumber: string | null;
    factsDate: string | null;
    startDate: string | null;
    verdictDate: string | null;
    sourceCount: number;
    sources: { url: string; title: string; publisher: string }[];
  }[];
}

function calculatePairScore(
  a: AffairForComparison,
  b: AffairForComparison
): { score: number; reasons: string[] } | null {
  const reasons: string[] = [];
  let score = 0;

  // Exact identifiers — definite match
  if (a.ecli && b.ecli && a.ecli === b.ecli) {
    return { score: 100, reasons: ["ECLI identique"] };
  }

  if (a.pourvoiNumber && b.pourvoiNumber && a.pourvoiNumber === b.pourvoiNumber) {
    return { score: 95, reasons: ["Numéro de pourvoi identique"] };
  }

  // Case number overlap
  if (a.caseNumbers.length > 0 && b.caseNumbers.length > 0) {
    const overlap = a.caseNumbers.filter((n) => b.caseNumbers.includes(n));
    if (overlap.length > 0) {
      score += 40;
      reasons.push(`Numéro(s) de dossier commun(s) : ${overlap.join(", ")}`);
    }
  }

  // Title similarity — normalized word overlap
  const wordsA = normalizeTitle(a.title);
  const wordsB = normalizeTitle(b.title);
  if (wordsA.length > 0 && wordsB.length > 0) {
    const common = wordsA.filter((w) => wordsB.includes(w));
    const ratio = common.length / Math.max(wordsA.length, wordsB.length);
    if (ratio >= 0.3) {
      score += Math.round(ratio * 50);
      reasons.push(`Titres similaires (${Math.round(ratio * 100)}% de mots communs)`);
    }
  }

  // Same category
  if (a.category === b.category) {
    score += 15;
    reasons.push("Même catégorie");
  }

  // Date proximity (use first available: facts, start, verdict)
  const dateA = a.factsDate || a.startDate || a.verdictDate;
  const dateB = b.factsDate || b.startDate || b.verdictDate;
  if (dateA && dateB) {
    const days = daysBetween(dateA, dateB);
    if (days <= 7) {
      score += 20;
      reasons.push("Dates très proches (< 7 jours)");
    } else if (days <= 30) {
      score += 15;
      reasons.push("Dates proches (< 30 jours)");
    } else if (days <= 90) {
      score += 10;
      reasons.push("Dates dans la même période (< 90 jours)");
    }
  }

  // Source URL overlap
  const urlsA = new Set(a.sources.map((s) => s.url));
  const urlsB = new Set(b.sources.map((s) => s.url));
  const commonUrls = [...urlsA].filter((u) => urlsB.has(u));
  if (commonUrls.length > 0) {
    score += 15;
    reasons.push(`${commonUrls.length} source(s) en commun`);
  }

  if (score < 40) return null;
  return { score: Math.min(score, 100), reasons };
}

export const GET = withAdminAuth(async (_request: NextRequest, context) => {
  const { id } = await context.params;

  const affairs = await db.affair.findMany({
    where: { politicianId: id },
    select: {
      id: true,
      title: true,
      status: true,
      category: true,
      involvement: true,
      publicationStatus: true,
      ecli: true,
      pourvoiNumber: true,
      caseNumbers: true,
      factsDate: true,
      startDate: true,
      verdictDate: true,
      description: true,
      sources: {
        select: { url: true, title: true, publisher: true },
      },
      _count: { select: { sources: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  if (affairs.length < 2) {
    return NextResponse.json({ groups: [], total: affairs.length });
  }

  // Pairwise comparison
  const groups: DuplicateGroup[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < affairs.length; i++) {
    for (let j = i + 1; j < affairs.length; j++) {
      const pairKey = `${affairs[i].id}:${affairs[j].id}`;
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      const result = calculatePairScore(affairs[i], affairs[j]);
      if (!result) continue;

      const format = (a: AffairForComparison) => ({
        id: a.id,
        title: a.title,
        status: a.status,
        category: a.category,
        involvement: a.involvement,
        publicationStatus: a.publicationStatus,
        ecli: a.ecli,
        pourvoiNumber: a.pourvoiNumber,
        factsDate: a.factsDate?.toISOString() || null,
        startDate: a.startDate?.toISOString() || null,
        verdictDate: a.verdictDate?.toISOString() || null,
        sourceCount: a._count.sources,
        sources: a.sources,
      });

      groups.push({
        score: result.score,
        reasons: result.reasons,
        affairs: [format(affairs[i]), format(affairs[j])],
      });
    }
  }

  // Sort by score descending
  groups.sort((a, b) => b.score - a.score);

  return NextResponse.json({ groups, total: affairs.length });
});
