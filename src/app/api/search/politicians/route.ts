import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * @openapi
 * /api/search/politicians:
 *   get:
 *     summary: Recherche de représentants
 *     description: Recherche par nom avec autocomplétion (retourne max 8 résultats)
 *     tags: [Recherche]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 2
 *         description: Terme de recherche (minimum 2 caractères)
 *         example: "macron"
 *       - in: query
 *         name: active
 *         schema:
 *           type: string
 *           enum: ["true", "false"]
 *           default: "false"
 *         description: Filtrer aux représentants avec mandat en cours et parti non dissous
 *     responses:
 *       200:
 *         description: Résultats de recherche
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SearchResult'
 *               maxItems: 8
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q") || "";
  const activeOnly = searchParams.get("active") === "true";

  if (query.length < 2) {
    return NextResponse.json([]);
  }

  const nameConditions = [
    { fullName: { contains: query, mode: "insensitive" as const } },
    { lastName: { contains: query, mode: "insensitive" as const } },
    { firstName: { contains: query, mode: "insensitive" as const } },
  ];

  const activeConditions = activeOnly
    ? [
        { mandates: { some: { isCurrent: true } } },
        {
          OR: [{ currentPartyId: null }, { currentParty: { dissolvedDate: null } }],
        },
      ]
    : [];

  const politicians = await db.politician.findMany({
    where: {
      AND: [{ OR: nameConditions }, ...activeConditions],
    },
    select: {
      id: true,
      fullName: true,
      slug: true,
      photoUrl: true,
      currentParty: {
        select: {
          name: true,
          shortName: true,
          color: true,
        },
      },
      mandates: {
        where: { isCurrent: true },
        select: { type: true },
        take: 1,
      },
    },
    orderBy: { lastName: "asc" },
    take: 8,
  });

  const results = politicians.map((p) => ({
    id: p.id,
    fullName: p.fullName,
    slug: p.slug,
    photoUrl: p.photoUrl,
    party: p.currentParty?.shortName || null,
    partyName: p.currentParty?.name || null,
    partyColor: p.currentParty?.color || null,
    mandate: p.mandates[0]?.type || null,
  }));

  return NextResponse.json(results);
}
