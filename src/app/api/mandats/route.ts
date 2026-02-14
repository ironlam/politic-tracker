import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { MandateType } from "@/generated/prisma";
import { withCache } from "@/lib/cache";

/**
 * @openapi
 * /api/mandats:
 *   get:
 *     summary: Liste des mandats politiques
 *     description: Retourne la liste paginée des mandats avec filtres optionnels
 *     tags: [Mandats]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [DEPUTE, SENATEUR, DEPUTE_EUROPEEN, PRESIDENT_REPUBLIQUE, PREMIER_MINISTRE, MINISTRE, SECRETAIRE_ETAT, MINISTRE_DELEGUE, PRESIDENT_REGION, PRESIDENT_DEPARTEMENT, MAIRE, ADJOINT_MAIRE, CONSEILLER_REGIONAL, CONSEILLER_DEPARTEMENTAL, CONSEILLER_MUNICIPAL, PRESIDENT_PARTI, OTHER]
 *         description: Filtrer par type de mandat
 *       - in: query
 *         name: isCurrent
 *         schema:
 *           type: string
 *           enum: ["true", "false"]
 *         description: Filtrer par mandats actifs ou terminés
 *       - in: query
 *         name: politicianId
 *         schema:
 *           type: string
 *         description: Filtrer par identifiant du politicien
 *       - in: query
 *         name: institution
 *         schema:
 *           type: string
 *         description: Recherche sur l'institution (insensible à la casse)
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
 *         description: Liste des mandats avec pagination
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MandateSummary'
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
  const isCurrent = searchParams.get("isCurrent");
  const politicianId = searchParams.get("politicianId");
  const institution = searchParams.get("institution");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const skip = (page - 1) * limit;

  const where = {
    ...(type && { type: type as MandateType }),
    ...(isCurrent && { isCurrent: isCurrent === "true" }),
    ...(politicianId && { politicianId }),
    ...(institution && {
      institution: { contains: institution, mode: "insensitive" as const },
    }),
  };

  try {
    const [mandates, total] = await Promise.all([
      db.mandate.findMany({
        where,
        select: {
          id: true,
          type: true,
          title: true,
          institution: true,
          role: true,
          constituency: true,
          departmentCode: true,
          startDate: true,
          endDate: true,
          isCurrent: true,
          politician: {
            select: {
              id: true,
              slug: true,
              fullName: true,
              photoUrl: true,
            },
          },
        },
        orderBy: { startDate: "desc" },
        skip,
        take: limit,
      }),
      db.mandate.count({ where }),
    ]);

    return withCache(
      NextResponse.json({
        data: mandates,
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
