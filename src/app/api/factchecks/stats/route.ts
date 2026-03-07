import { NextRequest, NextResponse } from "next/server";
import { factcheckStatsService } from "@/services/factcheckStats";
import { withCache } from "@/lib/cache";
import { parsePagination } from "@/lib/api/pagination";
import { withPublicRoute } from "@/lib/api/with-public-route";

/**
 * @openapi
 * /api/factchecks/stats:
 *   get:
 *     summary: Statistiques agrégées des fact-checks
 *     description: Retourne les statistiques par verdict, parti, politicien et source
 *     tags: [FactChecks]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 15
 *           minimum: 1
 *           maximum: 50
 *         description: Nombre max de partis/politiciens retournés
 *     responses:
 *       200:
 *         description: Statistiques agrégées des fact-checks
 *       500:
 *         description: Erreur serveur
 */
export const GET = withPublicRoute(async (request: NextRequest) => {
  const { limit } = parsePagination(request.nextUrl.searchParams, {
    defaultLimit: 15,
    maxLimit: 50,
  });

  const stats = await factcheckStatsService.getFactCheckStats({ limit });

  return withCache(NextResponse.json(stats), "stats");
});
