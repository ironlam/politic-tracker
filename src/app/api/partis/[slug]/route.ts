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
 *         description: Détail du parti avec membres et historique de direction
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/PartyDetails'
 *                 - type: object
 *                   properties:
 *                     leadership:
 *                       type: array
 *                       description: Historique des dirigeants du parti (actuel et passés)
 *                       items:
 *                         type: object
 *                         properties:
 *                           politicianId:
 *                             type: string
 *                           politicianSlug:
 *                             type: string
 *                           politicianName:
 *                             type: string
 *                           politicianPhoto:
 *                             type: string
 *                             nullable: true
 *                           title:
 *                             type: string
 *                           startDate:
 *                             type: string
 *                             format: date-time
 *                           endDate:
 *                             type: string
 *                             format: date-time
 *                             nullable: true
 *                           isCurrent:
 *                             type: boolean
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

    // Fetch leadership history
    const leadership = await db.mandate.findMany({
      where: { type: "PRESIDENT_PARTI", partyId: party.id },
      select: {
        id: true,
        title: true,
        startDate: true,
        endDate: true,
        isCurrent: true,
        politician: {
          select: { id: true, slug: true, fullName: true, photoUrl: true },
        },
      },
      orderBy: { startDate: "desc" },
    });

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
      leadership: leadership.map((m) => ({
        politicianId: m.politician.id,
        politicianSlug: m.politician.slug,
        politicianName: m.politician.fullName,
        politicianPhoto: m.politician.photoUrl,
        title: m.title,
        startDate: m.startDate,
        endDate: m.endDate,
        isCurrent: m.isCurrent,
      })),
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
