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
import { classifyThemes } from "../src/services/sync/classify-themes";

async function showStats() {
  console.log("Fetching theme classification stats...\n");

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
    limit = parseInt(limitArg.split("=")[1]!, 10);
    if (isNaN(limit) || limit < 1) {
      console.error("Invalid limit number");
      process.exit(1);
    }
  }

  let target: "all" | "dossiers" | "scrutins" = "all";
  const targetArg = args.find((a) => a.startsWith("--target="));
  if (targetArg) {
    const value = targetArg.split("=")[1];
    if (!["all", "dossiers", "scrutins"].includes(value!)) {
      console.error("Invalid target. Use --target=dossiers, --target=scrutins, or --target=all");
      process.exit(1);
    }
    target = value as typeof target;
  }

  const force = args.includes("--force");
  const dryRun = args.includes("--dry-run");

  // Check API key
  if (!process.env.ANTHROPIC_API_KEY && !dryRun) {
    console.error("\u274c ANTHROPIC_API_KEY environment variable is not set");
    process.exit(1);
  }

  const startTime = Date.now();

  console.log("=".repeat(50));
  console.log("Poligraph - Theme Classifier");
  console.log("=".repeat(50));
  console.log(`Mode: ${dryRun ? "DRY RUN (no writes)" : "LIVE"}`);
  console.log(`Target: ${target}`);
  console.log(`Force regenerate: ${force ? "Yes" : "No"}`);
  if (limit) console.log(`Limit: ${limit} items`);
  console.log(`Started at: ${new Date().toISOString()}`);

  const stats = await classifyThemes({ target, force, limit, dryRun });

  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const totalErrors = stats.dossiers.errors + stats.scrutins.errors;

  console.log("\n" + "=".repeat(50));
  console.log("Theme Classification Results:");
  console.log("=".repeat(50));
  console.log(
    `Status: ${totalErrors === 0 ? "\u2705 SUCCESS" : "\u26a0\ufe0f COMPLETED WITH ERRORS"}`
  );
  console.log(`Duration: ${duration}s`);
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);

  if (target === "all" || target === "dossiers") {
    console.log(`\nDossiers:`);
    console.log(`  Processed: ${stats.dossiers.processed}`);
    console.log(`  Pre-mapped (no AI): ${stats.dossiers.premapped}`);
    console.log(`  AI-classified: ${stats.dossiers.aiClassified}`);
    if (stats.dossiers.errors > 0) console.log(`  Errors: ${stats.dossiers.errors}`);
  }

  if (target === "all" || target === "scrutins") {
    console.log(`\nScrutins:`);
    console.log(`  Processed: ${stats.scrutins.processed}`);
    console.log(`  AI-classified: ${stats.scrutins.aiClassified}`);
    if (stats.scrutins.errors > 0) console.log(`  Errors: ${stats.scrutins.errors}`);
  }

  // Cost estimate
  const totalAiCalls = stats.dossiers.aiClassified + stats.scrutins.aiClassified;
  const estimatedTokens = totalAiCalls * 200;
  const estimatedCost = (estimatedTokens / 1000000) * 0.25;
  console.log(`\nEstimated cost: $${estimatedCost.toFixed(4)} (${totalAiCalls} AI calls)`);

  console.log("\n" + "=".repeat(50));
  process.exit(totalErrors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
