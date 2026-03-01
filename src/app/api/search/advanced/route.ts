import { NextRequest, NextResponse } from "next/server";
import { searchPoliticians, SearchFilters } from "@/services/search";
import { MandateType } from "@/generated/prisma";
import { withCache } from "@/lib/cache";
import { parsePagination } from "@/lib/api/pagination";

/**
 * @openapi
 * /api/search/advanced:
 *   get:
 *     summary: Recherche avancée de représentants
 *     description: Recherche avec filtres multiples (parti, mandat, département, affaires)
 *     tags: [Recherche]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *           minLength: 2
 *         description: Terme de recherche (nom, prénom)
 *         example: "dupont"
 *       - in: query
 *         name: party
 *         schema:
 *           type: string
 *         description: ID du parti politique
 *       - in: query
 *         name: mandate
 *         schema:
 *           type: string
 *           enum: [DEPUTE, SENATEUR, MINISTRE, PREMIER_MINISTRE, MINISTRE_DELEGUE, SECRETAIRE_ETAT, DEPUTE_EUROPEEN]
 *         description: Type de mandat actuel
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *         description: Nom du département
 *         example: "Paris"
 *       - in: query
 *         name: hasAffairs
 *         schema:
 *           type: boolean
 *         description: Filtrer par présence d'affaires judiciaires
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filtrer par statut actif (mandat en cours)
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
 *         description: Nombre de résultats par page
 *     responses:
 *       200:
 *         description: Résultats de recherche avec pagination
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       slug:
 *                         type: string
 *                       fullName:
 *                         type: string
 *                       photoUrl:
 *                         type: string
 *                         nullable: true
 *                       currentParty:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           shortName:
 *                             type: string
 *                           color:
 *                             type: string
 *                       currentMandate:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           type:
 *                             type: string
 *                           constituency:
 *                             type: string
 *                       affairsCount:
 *                         type: integer
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 suggestions:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Suggestions si aucun résultat
 *       500:
 *         description: Erreur serveur
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const query = searchParams.get("q") || "";
  const partyId = searchParams.get("party") || undefined;
  const mandateType = searchParams.get("mandate") as MandateType | undefined;
  const department = searchParams.get("department") || undefined;
  const hasAffairsParam = searchParams.get("hasAffairs");
  const isActiveParam = searchParams.get("isActive");
  const { page, limit } = parsePagination(searchParams, { defaultLimit: 20 });

  const hasAffairs =
    hasAffairsParam === "true" ? true : hasAffairsParam === "false" ? false : undefined;
  const isActive = isActiveParam === "true" ? true : isActiveParam === "false" ? false : undefined;

  const filters: SearchFilters = {
    query,
    partyId,
    mandateType,
    department,
    hasAffairs,
    isActive,
  };

  try {
    const results = await searchPoliticians(filters, page, limit);
    return withCache(NextResponse.json(results), "daily");
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Erreur de recherche" }, { status: 500 });
  }
}

/**
 * @openapi
 * /api/search/advanced/filters:
 *   get:
 *     summary: Options de filtres de recherche
 *     description: Retourne les options disponibles pour les filtres (partis, départements, types de mandat)
 *     tags: [Recherche]
 *     responses:
 *       200:
 *         description: Options de filtres
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 parties:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       shortName:
 *                         type: string
 *                       name:
 *                         type: string
 *                       color:
 *                         type: string
 *                       count:
 *                         type: integer
 *                 departments:
 *                   type: array
 *                   items:
 *                     type: string
 *                 mandateTypes:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                       count:
 *                         type: integer
 */
