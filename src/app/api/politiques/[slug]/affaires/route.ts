import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withCache } from "@/lib/cache";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

/**
 * @openapi
 * /api/politiques/{slug}/affaires:
 *   get:
 *     summary: Affaires d'un représentant
 *     description: Retourne toutes les affaires judiciaires d'un représentant politique
 *     tags: [Affaires]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Slug du représentant (ex. jean-dupont)
 *         example: nicolas-sarkozy
 *     responses:
 *       200:
 *         description: Affaires du représentant
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 politician:
 *                   $ref: '#/components/schemas/PoliticianSummary'
 *                 affairs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Affair'
 *                 total:
 *                   type: integer
 *       404:
 *         description: Représentant non trouvé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erreur serveur
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;

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
        affairs: {
          where: { publicationStatus: "PUBLISHED" },
          select: {
            id: true,
            slug: true,
            title: true,
            description: true,
            status: true,
            category: true,
            factsDate: true,
            startDate: true,
            verdictDate: true,
            sentence: true,
            appeal: true,
            createdAt: true,
            partyAtTime: {
              select: { shortName: true, name: true },
            },
            sources: {
              select: {
                id: true,
                url: true,
                title: true,
                publisher: true,
                publishedAt: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!politician) {
      return NextResponse.json({ error: "Politique non trouvé" }, { status: 404 });
    }

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
        affairs: politician.affairs,
        total: politician.affairs.length,
      }),
      "daily"
    );
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
