/**
 * Orchestration service for generating AI summaries for scrutins (votes).
 * Extracted from scripts/generate-scrutin-summaries.ts for Inngest compatibility.
 */

import { db } from "@/lib/db";
import { summarizeScrutin, type SummaryResponse } from "@/services/summarize";
import { AI_RATE_LIMIT_MS, AI_429_BACKOFF_MS } from "@/config/rate-limits";

export interface ScrutinSummariesResult {
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

export async function generateScrutinSummaries(options?: {
  limit?: number;
  force?: boolean;
  chamber?: "AN" | "SENAT";
}): Promise<ScrutinSummariesResult> {
  const { limit, force = false, chamber } = options ?? {};

  const stats: ScrutinSummariesResult = {
    processed: 0,
    generated: 0,
    skipped: 0,
    errors: [],
  };

  const whereClause: Record<string, unknown> = {};
  if (!force) {
    whereClause.summary = null;
  }
  if (chamber) {
    whereClause.chamber = chamber;
  }

  let scrutins = await db.scrutin.findMany({
    where: whereClause,
    orderBy: { votingDate: "desc" },
    select: {
      id: true,
      externalId: true,
      title: true,
      chamber: true,
      votingDate: true,
      result: true,
      votesFor: true,
      votesAgainst: true,
      votesAbstain: true,
    },
  });

  if (limit) {
    scrutins = scrutins.slice(0, limit);
  }

  console.log(`Found ${scrutins.length} scrutins to process`);

  if (scrutins.length === 0) {
    return stats;
  }

  for (let i = 0; i < scrutins.length; i++) {
    const scrutin = scrutins[i];

    try {
      const summary: SummaryResponse = await summarizeScrutin({
        title: scrutin.title,
        chamber: scrutin.chamber as "AN" | "SENAT",
        votingDate: scrutin.votingDate.toISOString().split("T")[0],
        result: scrutin.result as "ADOPTED" | "REJECTED",
        votesFor: scrutin.votesFor,
        votesAgainst: scrutin.votesAgainst,
        votesAbstain: scrutin.votesAbstain,
      });

      const formattedSummary = formatSummary(summary);

      await db.scrutin.update({
        where: { id: scrutin.id },
        data: {
          summary: formattedSummary,
          summaryDate: new Date(),
        },
      });

      stats.generated++;
      stats.processed++;

      if (i < scrutins.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, AI_RATE_LIMIT_MS));
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      stats.errors.push(`${scrutin.externalId}: ${errorMsg}`);
      stats.processed++;

      if (errorMsg.includes("429") || errorMsg.includes("rate")) {
        console.log("Rate limited, waiting 30s...");
        await new Promise((resolve) => setTimeout(resolve, AI_429_BACKOFF_MS));
      }
    }
  }

  return stats;
}
