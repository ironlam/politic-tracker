/**
 * CLI script to classify legislative dossiers and scrutins into thematic categories
 *
 * Usage:
 *   npx tsx scripts/classify-themes.ts                     # Classify all missing
 *   npx tsx scripts/classify-themes.ts --target=dossiers   # Only dossiers
 *   npx tsx scripts/classify-themes.ts --target=scrutins   # Only scrutins
 *   npx tsx scripts/classify-themes.ts --force             # Reclassify all
 *   npx tsx scripts/classify-themes.ts --limit=10          # Limit to N items
 *   npx tsx scripts/classify-themes.ts --dry-run           # Preview without writing
 *   npx tsx scripts/classify-themes.ts --stats             # Show current stats
 *   npx tsx scripts/classify-themes.ts --help              # Show help
 *
 * Requires: ANTHROPIC_API_KEY environment variable
 */

import "dotenv/config";
import { db } from "../src/lib/db";
import { classifyTheme, ThemeCategoryValue } from "../src/services/summarize";
import type { ThemeCategory } from "../src/generated/prisma";
import { AI_RATE_LIMIT_MS, AI_429_BACKOFF_MS } from "../src/config/rate-limits";

// Pre-mapping: dossier category (procedure type) → theme
const CATEGORY_TO_THEME: Record<string, ThemeCategory> = {
  Budget: "ECONOMIE_BUDGET",
  Économie: "ECONOMIE_BUDGET",
  Santé: "SANTE",
  International: "AFFAIRES_ETRANGERES_DEFENSE",
  Institutionnel: "INSTITUTIONS",
  Constitution: "INSTITUTIONS",
};

// Progress tracking
const isTTY = process.stdout.isTTY === true;
let lastMessageLength = 0;

function updateLine(message: string): void {
  if (isTTY) {
    process.stdout.write(`\r\x1b[K${message}`);
  } else {
    const padding = " ".repeat(Math.max(0, lastMessageLength - message.length));
    process.stdout.write(`\r${message}${padding}`);
  }
  lastMessageLength = message.length;
}

function renderProgressBar(current: number, total: number, width = 30): string {
  const percent = Math.round((current / total) * 100);
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  const bar = "\u2588".repeat(filled) + "\u2591".repeat(empty);
  return `[${bar}] ${percent}%`;
}

interface ClassifyOptions {
  target: "all" | "dossiers" | "scrutins";
  force: boolean;
  limit?: number;
  dryRun: boolean;
}

async function classifyDossiers(options: ClassifyOptions) {
  const { force, limit, dryRun } = options;

  const stats = {
    processed: 0,
    premapped: 0,
    aiClassified: 0,
    errors: [] as string[],
  };

  // Fetch dossiers needing classification
  const whereClause: Record<string, unknown> = {};
  if (!force) {
    whereClause.theme = null;
  }

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

  if (limit) {
    dossiers = dossiers.slice(0, limit);
  }

  const total = dossiers.length;
  console.log(`\nDossiers: ${total} to process`);

  if (total === 0) {
    console.log("\u2713 All dossiers already classified");
    return stats;
  }

  for (let i = 0; i < dossiers.length; i++) {
    const dossier = dossiers[i];
    const progressMsg = `${renderProgressBar(i + 1, total)} Dossiers ${i + 1}/${total}: ${dossier.externalId}`;
    updateLine(progressMsg);

    try {
      let theme: ThemeCategoryValue | null = null;

      // Phase 1: Try pre-mapping from category
      if (dossier.category && CATEGORY_TO_THEME[dossier.category]) {
        theme = CATEGORY_TO_THEME[dossier.category] as ThemeCategoryValue;
        stats.premapped++;
      }

      // Phase 2: AI classification if pre-mapping failed
      if (!theme) {
        if (dryRun) {
          stats.aiClassified++;
          stats.processed++;
          continue;
        }

        const context = dossier.exposeDesMotifs
          ? dossier.exposeDesMotifs.substring(0, 500)
          : undefined;

        theme = await classifyTheme(dossier.shortTitle || dossier.title, dossier.summary, context);

        if (theme) {
          stats.aiClassified++;
        }

        // Rate limiting between AI requests
        if (i < dossiers.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, AI_RATE_LIMIT_MS));
        }
      }

      if (theme && !dryRun) {
        await db.legislativeDossier.update({
          where: { id: dossier.id },
          data: { theme: theme as ThemeCategory },
        });
      }

      stats.processed++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      stats.errors.push(`${dossier.externalId}: ${errorMsg}`);
      stats.processed++;

      if (errorMsg.includes("429") || errorMsg.includes("rate")) {
        console.log("\n\u23f3 Rate limited, waiting 30s...");
        await new Promise((resolve) => setTimeout(resolve, AI_429_BACKOFF_MS));
      }
    }
  }

  console.log(""); // newline after progress bar
  return stats;
}

async function classifyScrutins(options: ClassifyOptions) {
  const { force, limit, dryRun } = options;

  const stats = {
    processed: 0,
    premapped: 0,
    aiClassified: 0,
    errors: [] as string[],
  };

  const whereClause: Record<string, unknown> = {};
  if (!force) {
    whereClause.theme = null;
  }

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

  if (limit) {
    scrutins = scrutins.slice(0, limit);
  }

  const total = scrutins.length;
  console.log(`\nScrutins: ${total} to process`);

  if (total === 0) {
    console.log("\u2713 All scrutins already classified");
    return stats;
  }

  for (let i = 0; i < scrutins.length; i++) {
    const scrutin = scrutins[i];
    const progressMsg = `${renderProgressBar(i + 1, total)} Scrutins ${i + 1}/${total}: ${scrutin.externalId}`;
    updateLine(progressMsg);

    try {
      if (dryRun) {
        stats.aiClassified++;
        stats.processed++;
        continue;
      }

      const theme = await classifyTheme(scrutin.title, scrutin.summary);

      if (theme) {
        await db.scrutin.update({
          where: { id: scrutin.id },
          data: { theme: theme as ThemeCategory },
        });
        stats.aiClassified++;
      }

      stats.processed++;

      // Rate limiting between AI requests
      if (i < scrutins.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, AI_RATE_LIMIT_MS));
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      stats.errors.push(`${scrutin.externalId}: ${errorMsg}`);
      stats.processed++;

      if (errorMsg.includes("429") || errorMsg.includes("rate")) {
        console.log("\n\u23f3 Rate limited, waiting 30s...");
        await new Promise((resolve) => setTimeout(resolve, AI_429_BACKOFF_MS));
      }
    }
  }

  console.log(""); // newline after progress bar
  return stats;
}

async function showStats() {
  console.log("Fetching theme classification stats...\n");

  // Dossier stats
  const totalDossiers = await db.legislativeDossier.count();
  const dossiersWithTheme = await db.legislativeDossier.count({
    where: { theme: { not: null } },
  });
  const dossiersByTheme = await db.legislativeDossier.groupBy({
    by: ["theme"],
    _count: true,
    orderBy: { _count: { theme: "desc" } },
  });

  console.log("Legislative Dossiers:");
  console.log(
    `  Total: ${totalDossiers}, With theme: ${dossiersWithTheme} (${totalDossiers > 0 ? ((dossiersWithTheme / totalDossiers) * 100).toFixed(1) : 0}%)`
  );
  console.log(`  Without theme: ${totalDossiers - dossiersWithTheme}`);
  if (dossiersByTheme.length > 0) {
    console.log("  By theme:");
    for (const t of dossiersByTheme) {
      if (t.theme) {
        console.log(`    ${t.theme}: ${t._count}`);
      }
    }
  }

  // Scrutin stats
  const totalScrutins = await db.scrutin.count();
  const scrutinsWithTheme = await db.scrutin.count({
    where: { theme: { not: null } },
  });
  const scrutinsByTheme = await db.scrutin.groupBy({
    by: ["theme"],
    _count: true,
    orderBy: { _count: { theme: "desc" } },
  });

  console.log("\nScrutins:");
  console.log(
    `  Total: ${totalScrutins}, With theme: ${scrutinsWithTheme} (${totalScrutins > 0 ? ((scrutinsWithTheme / totalScrutins) * 100).toFixed(1) : 0}%)`
  );
  console.log(`  Without theme: ${totalScrutins - scrutinsWithTheme}`);
  if (scrutinsByTheme.length > 0) {
    console.log("  By theme:");
    for (const t of scrutinsByTheme) {
      if (t.theme) {
        console.log(`    ${t.theme}: ${t._count}`);
      }
    }
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Poligraph - Theme Classifier

Usage:
  npx tsx scripts/classify-themes.ts                     Classify all missing themes
  npx tsx scripts/classify-themes.ts --target=dossiers   Only legislative dossiers
  npx tsx scripts/classify-themes.ts --target=scrutins   Only scrutins (votes)
  npx tsx scripts/classify-themes.ts --force             Reclassify all (overwrite existing)
  npx tsx scripts/classify-themes.ts --limit=10          Limit to first N items
  npx tsx scripts/classify-themes.ts --dry-run           Preview without writing
  npx tsx scripts/classify-themes.ts --stats             Show current stats

Features:
  - Pre-maps dossier categories (Budget, Santé...) to themes without AI
  - Uses Claude Haiku for AI classification
  - Rate-limited to avoid API throttling
  - 13 thematic categories covering all legislative topics
    `);
    process.exit(0);
  }

  if (args.includes("--stats")) {
    await showStats();
    process.exit(0);
  }

  // Parse options
  let limit: number | undefined;
  const limitArg = args.find((a) => a.startsWith("--limit="));
  if (limitArg) {
    limit = parseInt(limitArg.split("=")[1], 10);
    if (isNaN(limit) || limit < 1) {
      console.error("Invalid limit number");
      process.exit(1);
    }
  }

  let target: "all" | "dossiers" | "scrutins" = "all";
  const targetArg = args.find((a) => a.startsWith("--target="));
  if (targetArg) {
    const value = targetArg.split("=")[1];
    if (!["all", "dossiers", "scrutins"].includes(value)) {
      console.error("Invalid target. Use --target=dossiers, --target=scrutins, or --target=all");
      process.exit(1);
    }
    target = value as typeof target;
  }

  const force = args.includes("--force");
  const dryRun = args.includes("--dry-run");

  const startTime = Date.now();

  console.log("=".repeat(50));
  console.log("Poligraph - Theme Classifier");
  console.log("=".repeat(50));
  console.log(`Mode: ${dryRun ? "DRY RUN (no writes)" : "LIVE"}`);
  console.log(`Target: ${target}`);
  console.log(`Force regenerate: ${force ? "Yes" : "No"}`);
  if (limit) console.log(`Limit: ${limit} items`);
  console.log(`Started at: ${new Date().toISOString()}`);

  // Check API key
  if (!process.env.ANTHROPIC_API_KEY && !dryRun) {
    console.error("\u274c ANTHROPIC_API_KEY environment variable is not set");
    process.exit(1);
  }

  const options: ClassifyOptions = { target, force, limit, dryRun };

  let dossierStats = { processed: 0, premapped: 0, aiClassified: 0, errors: [] as string[] };
  let scrutinStats = { processed: 0, premapped: 0, aiClassified: 0, errors: [] as string[] };

  if (target === "all" || target === "dossiers") {
    dossierStats = await classifyDossiers(options);
  }

  if (target === "all" || target === "scrutins") {
    scrutinStats = await classifyScrutins(options);
  }

  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const allErrors = [...dossierStats.errors, ...scrutinStats.errors];

  console.log("\n" + "=".repeat(50));
  console.log("Theme Classification Results:");
  console.log("=".repeat(50));
  console.log(
    `Status: ${allErrors.length === 0 ? "\u2705 SUCCESS" : "\u26a0\ufe0f COMPLETED WITH ERRORS"}`
  );
  console.log(`Duration: ${duration}s`);
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);

  if (target === "all" || target === "dossiers") {
    console.log(`\nDossiers:`);
    console.log(`  Processed: ${dossierStats.processed}`);
    console.log(`  Pre-mapped (no AI): ${dossierStats.premapped}`);
    console.log(`  AI-classified: ${dossierStats.aiClassified}`);
  }

  if (target === "all" || target === "scrutins") {
    console.log(`\nScrutins:`);
    console.log(`  Processed: ${scrutinStats.processed}`);
    console.log(`  AI-classified: ${scrutinStats.aiClassified}`);
  }

  if (allErrors.length > 0) {
    console.log(`\n\u26a0\ufe0f Errors (${allErrors.length}):`);
    allErrors.slice(0, 5).forEach((e) => console.log(`  - ${e}`));
    if (allErrors.length > 5) {
      console.log(`  ... and ${allErrors.length - 5} more`);
    }
  }

  // Cost estimate
  const totalAiCalls = dossierStats.aiClassified + scrutinStats.aiClassified;
  const estimatedTokens = totalAiCalls * 200; // ~200 tokens per classification
  const estimatedCost = (estimatedTokens / 1000000) * 0.25; // Haiku input pricing
  console.log(`\nEstimated cost: $${estimatedCost.toFixed(4)} (${totalAiCalls} AI calls)`);

  console.log("\n" + "=".repeat(50));
  process.exit(allErrors.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
