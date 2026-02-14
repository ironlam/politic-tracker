import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ElectionType, ElectionStatus } from "@/generated/prisma";
import { withCache } from "@/lib/cache";

/**
 * @openapi
 * /api/elections:
 *   get:
 *     summary: Liste des élections
 *     description: Retourne la liste paginée des élections avec filtres optionnels
 *     tags: [Élections]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [PRESIDENTIELLE, LEGISLATIVES, SENATORIALES, MUNICIPALES, DEPARTEMENTALES, REGIONALES, EUROPEENNES, REFERENDUM]
 *         description: Filtrer par type d'élection
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [UPCOMING, REGISTRATION, CANDIDACIES, CAMPAIGN, ROUND_1, BETWEEN_ROUNDS, ROUND_2, COMPLETED]
 *         description: Filtrer par statut
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *         description: Filtrer par année du premier tour
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *         description: Numéro de page
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 100
 *         description: Nombre d'éléments par page
 *     responses:
 *       200:
 *         description: Liste des élections avec pagination
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ElectionSummary'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       500:
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const type = searchParams.get("type");
  const status = searchParams.get("status");
  const yearStr = searchParams.get("year");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const skip = (page - 1) * limit;

  const year = yearStr ? parseInt(yearStr, 10) : null;

  const where = {
    ...(type && { type: type as ElectionType }),
    ...(status && { status: status as ElectionStatus }),
    ...(year && {
      round1Date: {
        gte: new Date(year, 0, 1),
        lt: new Date(year + 1, 0, 1),
      },
    }),
  };

  try {
    const [elections, total] = await Promise.all([
      db.election.findMany({
        where,
        select: {
          id: true,
          slug: true,
          type: true,
          title: true,
          shortTitle: true,
          status: true,
          scope: true,
          suffrage: true,
          round1Date: true,
          round2Date: true,
          dateConfirmed: true,
          totalSeats: true,
          _count: { select: { candidacies: true } },
        },
        orderBy: { round1Date: "desc" },
        skip,
        take: limit,
      }),
      db.election.count({ where }),
    ]);

    const data = elections.map(({ _count, ...election }) => ({
      ...election,
      candidacyCount: _count.candidacies,
    }));

    return withCache(
      NextResponse.json({
        data,
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
