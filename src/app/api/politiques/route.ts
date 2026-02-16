import { NextRequest, NextResponse } from "next/server";
import { MandateType, PublicationStatus } from "@/generated/prisma";
import { getPoliticians } from "@/services/politicians";
import { withCache } from "@/lib/cache";

/**
 * @openapi
 * /api/politiques:
 *   get:
 *     summary: Liste des représentants politiques
 *     description: Retourne la liste paginée des représentants politiques français
 *     tags: [Politiques]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Recherche par nom
 *       - in: query
 *         name: partyId
 *         schema:
 *           type: string
 *         description: Filtrer par ID de parti politique
 *       - in: query
 *         name: mandateType
 *         schema:
 *           type: string
 *           enum: [DEPUTE, SENATEUR, DEPUTE_EUROPEEN, PRESIDENT, PREMIER_MINISTRE, MINISTRE, SECRETAIRE_ETAT, MAIRE, PRESIDENT_REGION, PRESIDENT_DEPARTEMENT, CONSEILLER_REGIONAL, CONSEILLER_DEPARTEMENTAL, CONSEILLER_MUNICIPAL]
 *         description: Filtrer par type de mandat actuel
 *       - in: query
 *         name: hasAffairs
 *         schema:
 *           type: boolean
 *         description: Filtrer les politiques avec/sans affaires judiciaires
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: ["PUBLISHED", "DRAFT", "ARCHIVED", "all"]
 *           default: "PUBLISHED"
 *         description: Statut de publication (défaut PUBLISHED)
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: ["name", "prominence"]
 *           default: "name"
 *         description: Tri des résultats
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
 *         description: Liste des représentants politiques avec pagination
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Politician'
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

  const search = searchParams.get("search") || undefined;
  const partyId = searchParams.get("partyId") || undefined;
  const mandateType = searchParams.get("mandateType") || undefined;
  const hasAffairsParam = searchParams.get("hasAffairs");
  const hasAffairs =
    hasAffairsParam === "true" ? true : hasAffairsParam === "false" ? false : undefined;
  const status = searchParams.get("status") || "PUBLISHED";
  const sort = searchParams.get("sort");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

  try {
    const result = await getPoliticians({
      search,
      partyId,
      mandateType: mandateType as MandateType,
      hasAffairs,
      ...(status !== "all" && { publicationStatus: status as PublicationStatus }),
      ...(sort === "prominence" && { sortBy: "prominence" as const }),
      page,
      limit,
    });

    return withCache(
      NextResponse.json({
        data: result.data.map((p) => ({
          id: p.id,
          slug: p.slug,
          fullName: p.fullName,
          firstName: p.firstName,
          lastName: p.lastName,
          civility: p.civility,
          birthDate: p.birthDate,
          deathDate: p.deathDate,
          birthPlace: p.birthPlace,
          photoUrl: p.photoUrl,
          currentParty: p.currentParty
            ? {
                id: p.currentParty.id,
                name: p.currentParty.name,
                shortName: p.currentParty.shortName,
                color: p.currentParty.color,
              }
            : null,
        })),
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      }),
      "daily"
    );
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
