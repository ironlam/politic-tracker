import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * @openapi
 * /api/compare/suggestions:
 *   get:
 *     summary: Suggestions de comparaisons populaires
 *     tags: [Comparaison]
 *     responses:
 *       200:
 *         description: Paires de politiciens à comparer
 */
export async function GET() {
  // Get top politicians by prominence, with diverse parties
  const top = await db.politician.findMany({
    where: {
      publicationStatus: "PUBLISHED",
      prominenceScore: { gte: 200 },
    },
    select: {
      slug: true,
      fullName: true,
      currentPartyId: true,
      prominenceScore: true,
    },
    orderBy: { prominenceScore: "desc" },
    take: 20,
  });

  // Generate diverse pairs (different parties)
  const pairs: { leftSlug: string; leftName: string; rightSlug: string; rightName: string }[] = [];
  const used = new Set<string>();

  for (let i = 0; i < top.length && pairs.length < 6; i++) {
    for (let j = i + 1; j < top.length && pairs.length < 6; j++) {
      const a = top[i];
      const b = top[j];
      // Different parties, neither already used
      if (
        a.currentPartyId !== b.currentPartyId &&
        !used.has(a.slug) &&
        !used.has(b.slug)
      ) {
        pairs.push({
          leftSlug: a.slug,
          leftName: a.fullName,
          rightSlug: b.slug,
          rightName: b.fullName,
        });
        used.add(a.slug);
        used.add(b.slug);
      }
    }
  }

  return NextResponse.json(pairs);
}
