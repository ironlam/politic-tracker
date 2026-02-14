import { NextRequest, NextResponse } from "next/server";
import { factcheckStatsService } from "@/services/factcheckStats";
import { withCache } from "@/lib/cache";

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
  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "15", 10)));

  try {
    const stats = await factcheckStatsService.getFactCheckStats({ limit });

    return withCache(NextResponse.json(stats), "stats");
  } catch (error) {
    console.error("Error fetching factcheck stats:", error);
    return NextResponse.json({ error: "Failed to fetch factcheck stats" }, { status: 500 });
  }
}
