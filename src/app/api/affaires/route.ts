import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * @openapi
 * /api/affaires:
 *   get:
 *     summary: Liste des affaires judiciaires
 *     description: Retourne la liste paginée des affaires judiciaires documentées avec leurs sources
 *     tags: [Affaires]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ENQUETE_PRELIMINAIRE, MISE_EN_EXAMEN, PROCES_EN_COURS, CONDAMNATION_PREMIERE_INSTANCE, CONDAMNATION_DEFINITIVE, APPEL_EN_COURS, RELAXE, NON_LIEU, PRESCRIPTION]
 *         description: Filtrer par statut judiciaire
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [CORRUPTION, FRAUDE_FISCALE, BLANCHIMENT, TRAFIC_INFLUENCE, PRISE_ILLEGALE_INTERET, VIOLENCE, HARCELEMENT_SEXUEL, DIFFAMATION]
 *         description: Filtrer par catégorie d'infraction
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
 *         description: Liste des affaires avec pagination
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Affair'
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

  const status = searchParams.get("status");
  const category = searchParams.get("category");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const skip = (page - 1) * limit;

  const where = {
    ...(status && { status: status as any }),
    ...(category && { category: category as any }),
  };

  try {
    const [affairs, total] = await Promise.all([
      db.affair.findMany({
        where,
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          status: true,
          category: true,
          factsDate: true,
          startDate: true,
          verdictDate: true,
          sentence: true,
          appeal: true,
          createdAt: true,
          updatedAt: true,
          politician: {
            select: {
              id: true,
              slug: true,
              fullName: true,
              currentParty: {
                select: { shortName: true, name: true },
              },
            },
          },
          partyAtTime: {
            select: { shortName: true, name: true },
          },
          sources: {
            select: {
              id: true,
              url: true,
              title: true,
              publisher: true,
              publishedAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.affair.count({ where }),
    ]);

    return NextResponse.json({
      data: affairs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
