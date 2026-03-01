/**
 * Orchestration service for generating AI summaries for legislative dossiers.
 * Extracted from scripts/generate-summaries.ts for Inngest compatibility.
 */

import { db } from "@/lib/db";
import { summarizeDossier, type SummaryResponse } from "@/services/summarize";
import { AI_RATE_LIMIT_MS, AI_429_BACKOFF_MS } from "@/config/rate-limits";

export interface SummariesResult {
  processed: number;
  generated: number;
  skipped: number;
  errors: string[];
}

function formatSummary(summary: SummaryResponse): string {
  let formatted = summary.shortSummary;

  if (summary.keyPoints.length > 0) {
    formatted += "\n\n**Points cl\u00e9s :**\n";
    for (const point of summary.keyPoints) {
      formatted += `\u2022 ${point}\n`;
    }
  }

  return formatted.trim();
}

export async function generateSummaries(options?: {
  limit?: number;
  force?: boolean;
  activeOnly?: boolean;
}): Promise<SummariesResult> {
  const { limit, force = false, activeOnly = true } = options ?? {};

  const stats: SummariesResult = {
    processed: 0,
    generated: 0,
    skipped: 0,
    errors: [],
  };

  const whereClause: Record<string, unknown> = {};
  if (!force) {
    whereClause.summary = null;
  }
  if (activeOnly) {
    whereClause.status = "EN_COURS";
  }

  let dossiers = await db.legislativeDossier.findMany({
    where: whereClause,
    orderBy: { filingDate: "desc" },
    select: {
      id: true,
      externalId: true,
      title: true,
      shortTitle: true,
      number: true,
      category: true,
      status: true,
      exposeDesMotifs: true,
    },
  });

  if (limit) {
    dossiers = dossiers.slice(0, limit);
  }

  console.log(`Found ${dossiers.length} dossiers to process`);

  if (dossiers.length === 0) {
    return stats;
  }

  for (let i = 0; i < dossiers.length; i++) {
    const dossier = dossiers[i];

    try {
      const summary: SummaryResponse = await summarizeDossier({
        title: dossier!.title,
        content: dossier!.exposeDesMotifs || dossier!.title,
        procedure: dossier!.category || undefined,
      });

      const formattedSummary = formatSummary(summary);

      await db.legislativeDossier.update({
        where: { id: dossier!.id },
        data: {
          summary: formattedSummary,
          summaryDate: new Date(),
        },
      });

      stats.generated++;
      stats.processed++;

      if (i < dossiers.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, AI_RATE_LIMIT_MS));
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      stats.errors.push(`${dossier!.externalId}: ${errorMsg}`);
      stats.processed++;

      if (errorMsg.includes("429") || errorMsg.includes("rate")) {
        console.log("Rate limited, waiting 30s...");
        await new Promise((resolve) => setTimeout(resolve, AI_429_BACKOFF_MS));
      }
    }
  }

  return stats;
}
