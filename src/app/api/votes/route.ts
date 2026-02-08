import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * @openapi
 * /api/votes:
 *   get:
 *     summary: Liste des scrutins parlementaires
 *     description: Retourne la liste paginée des scrutins publics (votes nominatifs)
 *     tags: [Votes]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Recherche dans le titre du scrutin
 *       - in: query
 *         name: result
 *         schema:
 *           type: string
 *           enum: [ADOPTED, REJECTED]
 *         description: Filtrer par résultat (adopté ou rejeté)
 *       - in: query
 *         name: legislature
 *         schema:
 *           type: integer
 *           example: 16
 *         description: Filtrer par législature
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
 *         description: Liste des scrutins avec pagination
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Scrutin'
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

  const search = searchParams.get("search");
  const result = searchParams.get("result");
  const legislature = searchParams.get("legislature");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const skip = (page - 1) * limit;

  const where = {
    ...(search && {
      title: { contains: search, mode: "insensitive" as const },
    }),
    ...(result && { result: result as "ADOPTED" | "REJECTED" }),
    ...(legislature && { legislature: parseInt(legislature, 10) }),
  };

  try {
    const [scrutins, total] = await Promise.all([
      db.scrutin.findMany({
        where,
        select: {
          id: true,
          externalId: true,
          title: true,
          votingDate: true,
          legislature: true,
          votesFor: true,
          votesAgainst: true,
          votesAbstain: true,
          result: true,
          sourceUrl: true,
          _count: {
            select: { votes: true },
          },
        },
        orderBy: { votingDate: "desc" },
        skip,
        take: limit,
      }),
      db.scrutin.count({ where }),
    ]);

    return NextResponse.json({
      data: scrutins.map((s) => ({
        ...s,
        totalVotes: s._count.votes,
        _count: undefined,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
