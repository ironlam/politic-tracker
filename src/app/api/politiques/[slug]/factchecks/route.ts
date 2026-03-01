import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withCache } from "@/lib/cache";
import { parsePagination } from "@/lib/api/pagination";

/**
 * @openapi
 * /api/politiques/{slug}/factchecks:
 *   get:
 *     summary: Fact-checks mentionnant un politicien
 *     description: Retourne la liste paginée des fact-checks mentionnant ce politicien
 *     tags: [Politiques]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Identifiant unique du représentant (ex. marine-le-pen)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Fact-checks du politicien avec pagination
 *       404:
 *         description: Politicien non trouvé
 *       500:
 *         description: Erreur serveur
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { searchParams } = new URL(request.url);

  const { page, limit, skip } = parsePagination(searchParams, { defaultLimit: 20 });

  try {
    const politician = await db.politician.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        fullName: true,
        firstName: true,
        lastName: true,
        photoUrl: true,
        currentParty: {
          select: { shortName: true, name: true, color: true },
        },
      },
    });

    if (!politician) {
      return NextResponse.json({ error: "Politicien non trouvé" }, { status: 404 });
    }

    const mentionWhere = { politicianId: politician.id };

    const [mentions, total] = await Promise.all([
      db.factCheckMention.findMany({
        where: mentionWhere,
        select: {
          factCheck: {
            select: {
              id: true,
              slug: true,
              claimText: true,
              claimant: true,
              title: true,
              verdict: true,
              verdictRating: true,
              source: true,
              sourceUrl: true,
              publishedAt: true,
              claimDate: true,
            },
          },
        },
        orderBy: { factCheck: { publishedAt: "desc" } },
        skip,
        take: limit,
      }),
      db.factCheckMention.count({ where: mentionWhere }),
    ]);

    return withCache(
      NextResponse.json({
        politician: {
          id: politician.id,
          slug: politician.slug,
          fullName: politician.fullName,
          firstName: politician.firstName,
          lastName: politician.lastName,
          photoUrl: politician.photoUrl,
          party: politician.currentParty,
        },
        factchecks: mentions.map((m) => m.factCheck),
        total,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }),
      "daily"
    );
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
