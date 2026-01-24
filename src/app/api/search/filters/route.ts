import { NextResponse } from "next/server";
import { getSearchFilterOptions } from "@/services/search";

/**
 * @openapi
 * /api/search/filters:
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
 *       500:
 *         description: Erreur serveur
 */
export async function GET() {
  try {
    const filters = await getSearchFilterOptions();
    return NextResponse.json(filters);
  } catch (error) {
    console.error("Filter options error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
