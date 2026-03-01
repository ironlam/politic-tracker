import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { summarizeDossier } from "@/services/summarize";

/**
 * POST /api/admin/dossiers/[id]/generate
 *
 * Generate AI summary for a legislative dossier.
 * Returns the summary for preview (does NOT save automatically).
 *
 * IMPORTANT: The summary is generated based on:
 * 1. The official title from data.assemblee-nationale.fr
 * 2. Any additional content we can fetch from the source
 *
 * The admin must review and approve before saving.
 */
export const POST = withAdminAuth(async (_request: NextRequest, context) => {
  const { id } = await context.params;

  // Fetch dossier from database
  const dossier = await db.legislativeDossier.findUnique({
    where: { id },
    include: {
      amendments: {
        where: { status: "ADOPTE" },
        take: 10,
      },
    },
  });

  if (!dossier) {
    return NextResponse.json({ error: "Dossier non trouvé" }, { status: 404 });
  }

  // Check API key is configured
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Clé API Anthropic non configurée. Contactez l'administrateur." },
      { status: 500 }
    );
  }

  // Build content for summarization
  // We use the official title and any metadata we have
  let content = `Titre officiel: ${dossier.title}\n`;

  if (dossier.number) {
    content += `Numéro: ${dossier.number}\n`;
  }

  if (dossier.category) {
    content += `Catégorie: ${dossier.category}\n`;
  }

  if (dossier.status) {
    const statusLabels: Record<string, string> = {
      DEPOSE: "Déposé",
      EN_COMMISSION: "En commission",
      EN_COURS: "En discussion",
      CONSEIL_CONSTITUTIONNEL: "Conseil constitutionnel",
      ADOPTE: "Adopté",
      REJETE: "Rejeté",
      RETIRE: "Retiré",
      CADUQUE: "Caduc",
    };
    content += `Statut: ${statusLabels[dossier.status] || dossier.status}\n`;
  }

  if (dossier.filingDate) {
    content += `Date de dépôt: ${dossier.filingDate.toISOString().split("T")[0]}\n`;
  }

  // Add adopted amendments info
  if (dossier.amendments.length > 0) {
    content += `\nAmendements adoptés (${dossier.amendments.length}):\n`;
    dossier.amendments.forEach((a) => {
      if (a.summary) {
        content += `- ${a.summary}\n`;
      } else if (a.article) {
        content += `- Modification de l'article ${a.article}\n`;
      }
    });
  }

  // Add source URL for reference
  if (dossier.sourceUrl) {
    content += `\nSource officielle: ${dossier.sourceUrl}`;
  }

  // Generate summary using the AI service
  try {
    const result = await summarizeDossier({
      title: dossier.title,
      content,
      procedure: dossier.category || undefined,
    });

    // Format the summary for display
    let formattedSummary = result.shortSummary;

    if (result.keyPoints.length > 0) {
      formattedSummary += "\n\n**Points clés :**\n";
      result.keyPoints.forEach((point) => {
        formattedSummary += `- ${point}\n`;
      });
    }

    // Add source attribution
    formattedSummary += `\n\n_Résumé généré automatiquement à partir des données officielles de l'Assemblée nationale._`;

    return NextResponse.json({
      summary: formattedSummary,
      shortSummary: result.shortSummary,
      keyPoints: result.keyPoints,
      sourceUrl: dossier.sourceUrl,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    // Provide helpful error messages
    if (error instanceof Error) {
      if (error.message.includes("ANTHROPIC_API_KEY")) {
        return NextResponse.json({ error: "Clé API Anthropic non configurée" }, { status: 500 });
      }
      if (error.message.includes("rate limit")) {
        return NextResponse.json(
          { error: "Limite de requêtes atteinte. Réessayez dans quelques instants." },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: `Erreur lors de la génération: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Erreur inconnue lors de la génération du résumé" },
      { status: 500 }
    );
  }
});
