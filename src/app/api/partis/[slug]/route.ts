import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * @openapi
 * /api/partis/{slug}:
 *   get:
 *     summary: Détail d'un parti politique
 *     description: Retourne les informations détaillées d'un parti avec ses membres actuels, identifiants externes et filiation
 *     tags: [Partis]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Slug du parti (ex. "les-republicains")
 *     responses:
 *       200:
 *         description: Détail du parti
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PartyDetails'
 *       404:
 *         description: Parti non trouvé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    const party = await db.party.findUnique({
      where: { slug },
      include: {
        politicians: {
          select: {
            id: true,
            slug: true,
            fullName: true,
            photoUrl: true,
            mandates: {
              where: { isCurrent: true },
              select: { type: true, title: true },
              take: 1,
            },
            _count: { select: { affairs: true } },
          },
        },
        externalIds: {
          select: { source: true, externalId: true, url: true },
        },
        predecessor: {
          select: { id: true, slug: true, name: true, shortName: true },
        },
        successors: {
          select: { id: true, slug: true, name: true, shortName: true },
        },
      },
    });

    if (!party) {
      return NextResponse.json({ error: "Parti non trouvé" }, { status: 404 });
    }

    const { politicians, ...rest } = party;

    const members = politicians.map(({ mandates, _count, ...p }) => ({
      ...p,
      currentMandate: mandates[0] ? { type: mandates[0].type, title: mandates[0].title } : null,
      affairsCount: _count.affairs,
    }));

    return NextResponse.json({
      ...rest,
      memberCount: members.length,
      members,
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
