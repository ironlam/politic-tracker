import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withPublicRoute } from "@/lib/api/with-public-route";
import { withCache } from "@/lib/cache";
import { FACTCHECK_ALLOWED_SOURCES } from "@/config/labels";

/**
 * @openapi
 * /api/stats:
 *   get:
 *     summary: Statistiques globales de la plateforme
 *     description: >
 *       Retourne les compteurs publics principaux de Poligraph :
 *       politiciens, partis, affaires, scrutins et fact-checks.
 *       Seules les entités publiées sont comptées.
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: Statistiques globales
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 politicians:
 *                   type: integer
 *                 parties:
 *                   type: integer
 *                 affairs:
 *                   type: integer
 *                 scrutins:
 *                   type: integer
 *                 factchecks:
 *                   type: integer
 *                 lastUpdated:
 *                   type: string
 *                   format: date-time
 */
export const GET = withPublicRoute(async () => {
  const [politicians, parties, affairs, scrutins, factchecks] = await Promise.all([
    db.politician.count({ where: { publicationStatus: "PUBLISHED" } }),
    db.party.count(),
    db.affair.count({ where: { publicationStatus: "PUBLISHED" } }),
    db.scrutin.count(),
    db.factCheck.count({ where: { source: { in: FACTCHECK_ALLOWED_SOURCES } } }),
  ]);

  return withCache(
    NextResponse.json({
      politicians,
      parties,
      affairs,
      scrutins,
      factchecks,
      lastUpdated: new Date().toISOString(),
    }),
    "daily"
  );
});
