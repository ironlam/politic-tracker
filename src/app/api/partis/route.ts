import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PoliticalPosition } from "@/generated/prisma";

/**
 * @openapi
 * /api/partis:
 *   get:
 *     summary: Liste des partis politiques
 *     description: Retourne la liste paginée des partis politiques avec filtres optionnels
 *     tags: [Partis]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Recherche sur le nom ou l'abréviation (insensible à la casse)
 *       - in: query
 *         name: position
 *         schema:
 *           type: string
 *           enum: [FAR_LEFT, LEFT, CENTER_LEFT, CENTER, CENTER_RIGHT, RIGHT, FAR_RIGHT]
 *         description: Filtrer par position sur l'échiquier politique
 *       - in: query
 *         name: active
 *         schema:
 *           type: string
 *           enum: ["true", "false"]
 *         description: "true = non dissous avec des membres, false = dissous"
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
 *         description: Liste des partis avec pagination
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Party'
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
  const position = searchParams.get("position");
  const active = searchParams.get("active");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const skip = (page - 1) * limit;

  const where = {
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { shortName: { contains: search, mode: "insensitive" as const } },
      ],
    }),
    ...(position && { politicalPosition: position as PoliticalPosition }),
    ...(active === "true" && {
      dissolvedDate: null,
      politicians: { some: {} },
    }),
    ...(active === "false" && { dissolvedDate: { not: null } }),
  };

  try {
    const [parties, total] = await Promise.all([
      db.party.findMany({
        where,
        select: {
          id: true,
          slug: true,
          name: true,
          shortName: true,
          color: true,
          politicalPosition: true,
          logoUrl: true,
          foundedDate: true,
          dissolvedDate: true,
          website: true,
          _count: { select: { politicians: true } },
        },
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
      db.party.count({ where }),
    ]);

    const data = parties.map(({ _count, ...party }) => ({
      ...party,
      memberCount: _count.politicians,
    }));

    return NextResponse.json({
      data,
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
