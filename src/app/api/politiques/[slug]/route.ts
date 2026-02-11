import { NextRequest, NextResponse } from "next/server";
import { getPoliticianBySlug } from "@/services/politicians";

/**
 * @openapi
 * /api/politiques/{slug}:
 *   get:
 *     summary: Détails d'un représentant politique
 *     description: Retourne les informations détaillées d'un représentant politique, incluant ses mandats et déclarations
 *     tags: [Politiques]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Identifiant unique du représentant (ex. emmanuel-macron)
 *     responses:
 *       200:
 *         description: Détails du représentant politique
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PoliticianDetails'
 *       404:
 *         description: Représentant non trouvé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  try {
    const politician = await getPoliticianBySlug(slug);

    if (!politician) {
      return NextResponse.json({ error: "Représentant non trouvé" }, { status: 404 });
    }

    return NextResponse.json({
      id: politician.id,
      slug: politician.slug,
      fullName: politician.fullName,
      firstName: politician.firstName,
      lastName: politician.lastName,
      civility: politician.civility,
      birthDate: politician.birthDate,
      deathDate: politician.deathDate,
      birthPlace: politician.birthPlace,
      photoUrl: politician.photoUrl,
      currentParty: politician.currentParty
        ? {
            id: politician.currentParty.id,
            name: politician.currentParty.name,
            shortName: politician.currentParty.shortName,
            color: politician.currentParty.color,
          }
        : null,
      mandates: politician.mandates.map((m) => ({
        id: m.id,
        type: m.type,
        title: m.title,
        institution: m.institution,
        constituency: m.constituency,
        startDate: m.startDate,
        endDate: m.endDate,
        isCurrent: m.isCurrent,
      })),
      declarations: politician.declarations.map((d) => ({
        id: d.id,
        type: d.type,
        year: d.year,
        url: d.pdfUrl,
      })),
      affairsCount: politician.affairs.length,
      factchecksCount:
        (politician as unknown as { _count: { factCheckMentions: number } })._count
          ?.factCheckMentions ?? 0,
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
