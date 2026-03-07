/**
 * Orchestration service for generating AI citizen impact explanations for scrutins.
 * Extracted from scripts/generate-citizen-impact.ts for Inngest compatibility.
 */

import { db } from "@/lib/db";
import {
  generateCitizenImpact,
  HAIKU_MODEL,
  type CitizenImpactInput,
} from "@/services/scrutin-citizen-impact";
import { fetchScrutinContext } from "@/services/scrutin-context-fetcher";
import { AI_RATE_LIMIT_MS, AI_429_BACKOFF_MS } from "@/config/rate-limits";

export interface ScrutinCitizenImpactsResult {
  processed: number;
  generated: number;
  skipped: number;
  contextHits: number;
  errors: string[];
}

export async function generateScrutinCitizenImpacts(options?: {
  limit?: number;
  force?: boolean;
  skipScrape?: boolean;
}): Promise<ScrutinCitizenImpactsResult> {
  const { limit, force = false, skipScrape = true } = options ?? {};

  const stats: ScrutinCitizenImpactsResult = {
    processed: 0,
    generated: 0,
    skipped: 0,
    contextHits: 0,
    errors: [],
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereClause: any = {};
  if (!force) {
    whereClause.citizenImpact = null;
  }
  // Only process scrutins that already have a summary (meaningful content)
  whereClause.summary = { not: null };

  let scrutins = await db.scrutin.findMany({
    where: whereClause,
    orderBy: { votingDate: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      theme: true,
      result: true,
      votesFor: true,
      votesAgainst: true,
      votesAbstain: true,
      chamber: true,
      votingDate: true,
      sourceUrl: true,
      dossierLegislatifId: true,
    },
  });

  if (limit) {
    scrutins = scrutins.slice(0, limit);
  }

  console.log(`[citizen-impacts] Found ${scrutins.length} scrutins to process`);

  if (scrutins.length === 0) {
    return stats;
  }

  for (let i = 0; i < scrutins.length; i++) {
    const scrutin = scrutins[i]!;

    try {
      // 1. Fetch enriched context (prefer FK, fallback to title match)
      const context = await fetchScrutinContext(scrutin.title, scrutin.sourceUrl, db, {
        skipScrape,
        dossierLegislatifId: scrutin.dossierLegislatifId,
      });

      if (context.dossierTitle || context.sourcePageText) {
        stats.contextHits++;
      }

      // 2. Build internal links for AI to embed
      const links: CitizenImpactInput["links"] = {
        dossierUrl: null,
        dossierLabel: null,
        relatedVotes: [],
      };

      if (context.dossierSlug) {
        links.dossierUrl = `/assemblee/${context.dossierSlug}`;
        links.dossierLabel = context.dossierTitle ?? "Dossier législatif";
      }

      // Find related votes on the same dossier via FK
      if (scrutin.dossierLegislatifId) {
        const relatedScrutins = await db.scrutin.findMany({
          where: {
            dossierLegislatifId: scrutin.dossierLegislatifId,
            id: { not: scrutin.id },
            slug: { not: null },
          },
          select: { slug: true, title: true },
          orderBy: { votingDate: "desc" },
          take: 3,
        });
        for (const related of relatedScrutins) {
          links.relatedVotes.push({
            url: `/votes/${related.slug}`,
            label: related.title.slice(0, 80),
          });
        }
      }

      // 3. Build input
      const input: CitizenImpactInput = {
        title: scrutin.title,
        summary: scrutin.summary,
        theme: scrutin.theme,
        result: scrutin.result as "ADOPTED" | "REJECTED",
        votesFor: scrutin.votesFor,
        votesAgainst: scrutin.votesAgainst,
        votesAbstain: scrutin.votesAbstain,
        chamber: scrutin.chamber as "AN" | "SENAT",
        votingDate: scrutin.votingDate.toISOString().split("T")[0]!,
        dossierTitle: context.dossierTitle,
        dossierSummary: context.dossierSummary,
        sourcePageText: context.sourcePageText,
        links,
      };

      // 4. Generate (Haiku for cost-effective batch processing)
      const result = await generateCitizenImpact(input, HAIKU_MODEL);

      // 5. Skip low-confidence (procedural votes)
      if (result.confidence < 40) {
        stats.skipped++;
        stats.processed++;
        continue;
      }

      // 6. Update DB
      await db.scrutin.update({
        where: { id: scrutin.id },
        data: {
          citizenImpact: result.citizenImpact,
          citizenImpactDate: new Date(),
        },
      });

      stats.generated++;
      stats.processed++;

      // Rate limit between calls
      if (i < scrutins.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, AI_RATE_LIMIT_MS));
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      stats.errors.push(`${scrutin.title.slice(0, 50)}: ${errorMsg}`);
      stats.processed++;

      if (errorMsg.includes("429") || errorMsg.includes("rate")) {
        console.log("[citizen-impacts] Rate limited, waiting 30s...");
        await new Promise((resolve) => setTimeout(resolve, AI_429_BACKOFF_MS));
      }
    }
  }

  return stats;
}
