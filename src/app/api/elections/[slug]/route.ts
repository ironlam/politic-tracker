import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * @openapi
 * /api/elections/{slug}:
 *   get:
 *     summary: Détail d'une élection
 *     description: Retourne les informations détaillées d'une élection avec ses candidatures et tours
 *     tags: [Élections]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Slug de l'élection (ex. "municipales-2026")
 *     responses:
 *       200:
 *         description: Détail de l'élection
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ElectionDetails'
 *       404:
 *         description: Élection non trouvée
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
    const election = await db.election.findUnique({
      where: { slug },
      include: {
        candidacies: {
          select: {
            id: true,
            candidateName: true,
            partyLabel: true,
            constituencyName: true,
            isElected: true,
            round1Votes: true,
            round1Pct: true,
            round2Votes: true,
            round2Pct: true,
            politician: {
              select: {
                id: true,
                slug: true,
                fullName: true,
                photoUrl: true,
              },
            },
            party: {
              select: {
                id: true,
                slug: true,
                shortName: true,
                color: true,
              },
            },
          },
          orderBy: [{ isElected: "desc" }, { round1Pct: "desc" }],
        },
        rounds: {
          select: {
            round: true,
            date: true,
            registeredVoters: true,
            actualVoters: true,
            participationRate: true,
            blankVotes: true,
            nullVotes: true,
          },
          orderBy: { round: "asc" },
        },
      },
    });

    if (!election) {
      return NextResponse.json({ error: "Élection non trouvée" }, { status: 404 });
    }

    return NextResponse.json(election);
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
