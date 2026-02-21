/**
 * Theme classification service for legislative dossiers and scrutins.
 *
 * Two-phase approach:
 * 1. Pre-mapping from known dossier categories
 * 2. AI classification via Claude for the rest
 */

import { db } from "@/lib/db";
import { classifyTheme, ThemeCategoryValue } from "@/services/summarize";
import type { ThemeCategory } from "@/generated/prisma";
import { AI_RATE_LIMIT_MS, AI_429_BACKOFF_MS } from "@/config/rate-limits";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClassifyThemesOptions {
  target?: "all" | "dossiers" | "scrutins";
  force?: boolean;
  limit?: number;
  dryRun?: boolean;
}

export interface ClassifyThemesStats {
  dossiers: { processed: number; premapped: number; aiClassified: number; errors: number };
  scrutins: { processed: number; aiClassified: number; errors: number };
}

// ---------------------------------------------------------------------------
// Pre-mapping
// ---------------------------------------------------------------------------

const CATEGORY_TO_THEME: Record<string, ThemeCategory> = {
  Budget: "ECONOMIE_BUDGET",
  Économie: "ECONOMIE_BUDGET",
  Santé: "SANTE",
  International: "AFFAIRES_ETRANGERES_DEFENSE",
  Institutionnel: "INSTITUTIONS",
  Constitution: "INSTITUTIONS",
};

// ---------------------------------------------------------------------------
// Main service
// ---------------------------------------------------------------------------

export async function classifyThemes(
  options: ClassifyThemesOptions = {}
): Promise<ClassifyThemesStats> {
  const { target = "all", force = false, limit, dryRun = false } = options;

  const stats: ClassifyThemesStats = {
    dossiers: { processed: 0, premapped: 0, aiClassified: 0, errors: 0 },
    scrutins: { processed: 0, aiClassified: 0, errors: 0 },
  };

  if (target === "all" || target === "dossiers") {
    await classifyDossiers(stats, { force, limit, dryRun });
  }

  if (target === "all" || target === "scrutins") {
    await classifyScrutins(stats, { force, limit, dryRun });
  }

  return stats;
}

async function classifyDossiers(
  stats: ClassifyThemesStats,
  opts: { force: boolean; limit?: number; dryRun: boolean }
) {
  const whereClause: Record<string, unknown> = {};
  if (!opts.force) whereClause.theme = null;

  let dossiers = await db.legislativeDossier.findMany({
    where: whereClause,
    orderBy: { filingDate: "desc" },
    select: {
      id: true,
      externalId: true,
      title: true,
      shortTitle: true,
      category: true,
      summary: true,
      exposeDesMotifs: true,
    },
  });

  if (opts.limit) dossiers = dossiers.slice(0, opts.limit);

  for (let i = 0; i < dossiers.length; i++) {
    const dossier = dossiers[i];

    try {
      let theme: ThemeCategoryValue | null = null;

      // Phase 1: Try pre-mapping from category
      if (dossier.category && CATEGORY_TO_THEME[dossier.category]) {
        theme = CATEGORY_TO_THEME[dossier.category] as ThemeCategoryValue;
        stats.dossiers.premapped++;
      }

      // Phase 2: AI classification if pre-mapping failed
      if (!theme) {
        if (opts.dryRun) {
          stats.dossiers.aiClassified++;
          stats.dossiers.processed++;
          continue;
        }

        const context = dossier.exposeDesMotifs
          ? dossier.exposeDesMotifs.substring(0, 500)
          : undefined;

        theme = await classifyTheme(dossier.shortTitle || dossier.title, dossier.summary, context);

        if (theme) stats.dossiers.aiClassified++;

        // Rate limiting between AI requests
        if (i < dossiers.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, AI_RATE_LIMIT_MS));
        }
      }

      if (theme && !opts.dryRun) {
        await db.legislativeDossier.update({
          where: { id: dossier.id },
          data: { theme: theme as ThemeCategory },
        });
      }

      stats.dossiers.processed++;
    } catch (err) {
      stats.dossiers.errors++;
      stats.dossiers.processed++;

      const errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.includes("429") || errorMsg.includes("rate")) {
        await new Promise((resolve) => setTimeout(resolve, AI_429_BACKOFF_MS));
      }
    }
  }
}

async function classifyScrutins(
  stats: ClassifyThemesStats,
  opts: { force: boolean; limit?: number; dryRun: boolean }
) {
  const whereClause: Record<string, unknown> = {};
  if (!opts.force) whereClause.theme = null;

  let scrutins = await db.scrutin.findMany({
    where: whereClause,
    orderBy: { votingDate: "desc" },
    select: {
      id: true,
      externalId: true,
      title: true,
      summary: true,
    },
  });

  if (opts.limit) scrutins = scrutins.slice(0, opts.limit);

  for (let i = 0; i < scrutins.length; i++) {
    const scrutin = scrutins[i];

    try {
      if (opts.dryRun) {
        stats.scrutins.aiClassified++;
        stats.scrutins.processed++;
        continue;
      }

      const theme = await classifyTheme(scrutin.title, scrutin.summary);

      if (theme) {
        await db.scrutin.update({
          where: { id: scrutin.id },
          data: { theme: theme as ThemeCategory },
        });
        stats.scrutins.aiClassified++;
      }

      stats.scrutins.processed++;

      // Rate limiting between AI requests
      if (i < scrutins.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, AI_RATE_LIMIT_MS));
      }
    } catch (err) {
      stats.scrutins.errors++;
      stats.scrutins.processed++;

      const errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.includes("429") || errorMsg.includes("rate")) {
        await new Promise((resolve) => setTimeout(resolve, AI_429_BACKOFF_MS));
      }
    }
  }
}
