import { NextRequest, NextResponse } from "next/server";
import { factcheckStatsService } from "@/services/factcheckStats";
import { withCache } from "@/lib/cache";
import { parsePagination } from "@/lib/api/pagination";

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
export async function GET(request: NextRequest) {
  const { limit } = parsePagination(request.nextUrl.searchParams, {
    defaultLimit: 15,
    maxLimit: 50,
  });

  try {
    const stats = await factcheckStatsService.getFactCheckStats({ limit });

    return withCache(NextResponse.json(stats), "stats");
  } catch (error) {
    console.error("Error fetching factcheck stats:", error);
    return NextResponse.json({ error: "Failed to fetch factcheck stats" }, { status: 500 });
  }
}
