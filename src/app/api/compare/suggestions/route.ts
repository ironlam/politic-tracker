import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withCache } from "@/lib/cache";
import type { PoliticalPosition } from "@/types";

const POSITION_ORDER: PoliticalPosition[] = [
  "FAR_LEFT",
  "LEFT",
  "CENTER_LEFT",
  "CENTER",
  "CENTER_RIGHT",
  "RIGHT",
  "FAR_RIGHT",
];

function oppositionDistance(a: PoliticalPosition | null, b: PoliticalPosition | null): number {
  if (!a || !b) return 0;
  const idxA = POSITION_ORDER.indexOf(a);
  const idxB = POSITION_ORDER.indexOf(b);
  if (idxA === -1 || idxB === -1) return 0;
  return Math.abs(idxA - idxB);
}

const POLITICIAN_FALLBACKS = [
  {
    leftSlug: "jean-luc-melenchon",
    leftName: "Jean-Luc Mélenchon",
    rightSlug: "marine-le-pen",
    rightName: "Marine Le Pen",
  },
  {
    leftSlug: "jordan-bardella",
    leftName: "Jordan Bardella",
    rightSlug: "mathilde-panot",
    rightName: "Mathilde Panot",
  },
  {
    leftSlug: "emmanuel-macron",
    leftName: "Emmanuel Macron",
    rightSlug: "jean-luc-melenchon",
    rightName: "Jean-Luc Mélenchon",
  },
];

const PARTY_FALLBACKS = [
  {
    leftSlug: "la-france-insoumise",
    leftName: "La France Insoumise",
    rightSlug: "rassemblement-national",
    rightName: "Rassemblement National",
  },
  {
    leftSlug: "renaissance",
    leftName: "Renaissance",
    rightSlug: "rassemblement-national",
    rightName: "Rassemblement National",
  },
  {
    leftSlug: "socialistes-et-apparentes",
    leftName: "Parti Socialiste",
    rightSlug: "les-republicains",
    rightName: "Les Républicains",
  },
  {
    leftSlug: "ecologiste-et-social",
    leftName: "Écologistes",
    rightSlug: "rassemblement-national",
    rightName: "Rassemblement National",
  },
];

/**
 * @openapi
 * /api/compare/suggestions:
 *   get:
 *     summary: Suggestions de comparaisons populaires
 *     tags: [Comparaison]
 *     parameters:
 *       - name: mode
 *         in: query
 *         schema:
 *           type: string
 *           enum: [partis]
 *     responses:
 *       200:
 *         description: Paires de politiciens ou partis à comparer
 */
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("mode");

  if (mode === "partis") {
    return getPartySuggestions();
  }
  return getPoliticianSuggestions();
}

async function getPoliticianSuggestions() {
  try {
    const top = await db.politician.findMany({
      where: {
        publicationStatus: "PUBLISHED",
        prominenceScore: { gte: 150 },
      },
      select: {
        slug: true,
        fullName: true,
        currentPartyId: true,
        prominenceScore: true,
        currentParty: {
          select: { politicalPosition: true },
        },
      },
      orderBy: { prominenceScore: "desc" },
      take: 30,
    });

    type Pair = {
      leftSlug: string;
      leftName: string;
      rightSlug: string;
      rightName: string;
      score: number;
    };
    const candidates: Pair[] = [];

    for (let i = 0; i < top.length; i++) {
      for (let j = i + 1; j < top.length; j++) {
        const a = top[i];
        const b = top[j];
        if (a!.currentPartyId === b!.currentPartyId) continue;

        const distance = oppositionDistance(
          a!.currentParty?.politicalPosition as PoliticalPosition | null,
          b!.currentParty?.politicalPosition as PoliticalPosition | null
        );
        const score = distance * 100 + (a!.prominenceScore || 0) + (b!.prominenceScore || 0);
        candidates.push({
          leftSlug: a!.slug,
          leftName: a!.fullName,
          rightSlug: b!.slug,
          rightName: b!.fullName,
          score,
        });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    const pairs: Pair[] = [];
    const used = new Set<string>();

    for (const c of candidates) {
      if (pairs.length >= 6) break;
      if (used.has(c.leftSlug) || used.has(c.rightSlug)) continue;
      pairs.push(c);
      used.add(c.leftSlug);
      used.add(c.rightSlug);
    }

    if (pairs.length === 0) return withCache(NextResponse.json(POLITICIAN_FALLBACKS), "static");

    return withCache(
      NextResponse.json(
        pairs.map(({ leftSlug, leftName, rightSlug, rightName }) => ({
          leftSlug,
          leftName,
          rightSlug,
          rightName,
        }))
      ),
      "static"
    );
  } catch {
    return withCache(NextResponse.json(POLITICIAN_FALLBACKS), "static");
  }
}

async function getPartySuggestions() {
  try {
    const parties = await db.party.findMany({
      where: {
        slug: { not: null },
        dissolvedDate: null,
        politicians: { some: { mandates: { some: { isCurrent: true } } } },
      },
      select: {
        slug: true,
        name: true,
        shortName: true,
        politicalPosition: true,
        _count: { select: { politicians: true } },
      },
      orderBy: { politicians: { _count: "desc" } },
      take: 15,
    });

    type Pair = {
      leftSlug: string;
      leftName: string;
      rightSlug: string;
      rightName: string;
      score: number;
    };
    const candidates: Pair[] = [];

    for (let i = 0; i < parties.length; i++) {
      for (let j = i + 1; j < parties.length; j++) {
        const a = parties[i];
        const b = parties[j];
        const distance = oppositionDistance(
          a!.politicalPosition as PoliticalPosition | null,
          b!.politicalPosition as PoliticalPosition | null
        );
        const score = distance * 100 + a!._count.politicians + b!._count.politicians;
        candidates.push({
          leftSlug: a!.slug as string,
          leftName: a!.shortName || a!.name,
          rightSlug: b!.slug as string,
          rightName: b!.shortName || b!.name,
          score,
        });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    const pairs: Pair[] = [];
    const used = new Set<string>();

    for (const c of candidates) {
      if (pairs.length >= 4) break;
      if (used.has(c.leftSlug) || used.has(c.rightSlug)) continue;
      pairs.push(c);
      used.add(c.leftSlug);
      used.add(c.rightSlug);
    }

    if (pairs.length === 0) return withCache(NextResponse.json(PARTY_FALLBACKS), "static");

    return withCache(
      NextResponse.json(
        pairs.map(({ leftSlug, leftName, rightSlug, rightName }) => ({
          leftSlug,
          leftName,
          rightSlug,
          rightName,
        }))
      ),
      "static"
    );
  } catch {
    return withCache(NextResponse.json(PARTY_FALLBACKS), "static");
  }
}
