/**
 * CLI script to generate AI summaries for legislative dossiers
 *
 * Usage:
 *   npx tsx scripts/generate-summaries.ts              # Generate missing summaries
 *   npx tsx scripts/generate-summaries.ts --force      # Regenerate all summaries
 *   npx tsx scripts/generate-summaries.ts --limit=10   # Limit to N dossiers
 *   npx tsx scripts/generate-summaries.ts --dry-run    # Preview without writing
 *   npx tsx scripts/generate-summaries.ts --stats      # Show current stats
 *   npx tsx scripts/generate-summaries.ts --help       # Show help
 *
 * Requires: ANTHROPIC_API_KEY environment variable
 */

import "dotenv/config";
import { db } from "../src/lib/db";
import { summarizeDossier, SummaryResponse } from "../src/services/summarize";

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

function renderProgressBar(current: number, total: number, width: number = 30): string {
  const percent = Math.round((current / total) * 100);
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);
  return `[${bar}] ${percent}%`;
}

/**
 * Generate summaries for dossiers
 */
async function generateSummaries(options: {
  force?: boolean;
  limit?: number;
  dryRun?: boolean;
  activeOnly?: boolean;
}) {
  const { force = false, limit, dryRun = false, activeOnly = true } = options;

  console.log("=".repeat(50));
  console.log("Poligraph - AI Summary Generator");
  console.log("=".repeat(50));
  console.log(`Mode: ${dryRun ? "DRY RUN (no writes)" : "LIVE"}`);
  console.log(`Force regenerate: ${force ? "Yes" : "No"}`);
  console.log(`Active dossiers only: ${activeOnly ? "Yes" : "No"}`);
  if (limit) console.log(`Limit: ${limit} dossiers`);
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log("");

  // Check API key
  if (!process.env.ANTHROPIC_API_KEY && !dryRun) {
    console.error("❌ ANTHROPIC_API_KEY environment variable is not set");
    process.exit(1);
  }

  const startTime = Date.now();
  const stats = {
    processed: 0,
    generated: 0,
    skipped: 0,
    errors: [] as string[],
  };

  // Fetch dossiers needing summaries
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

  const total = dossiers.length;
  console.log(`Found ${total} dossiers to process\n`);

  if (total === 0) {
    console.log("✓ No dossiers need summaries");
    return;
  }

  // Process each dossier
  for (let i = 0; i < dossiers.length; i++) {
    const dossier = dossiers[i];
    const progressMsg = `${renderProgressBar(i + 1, total)} Processing ${i + 1}/${total}: ${dossier.number || dossier.externalId}`;
    updateLine(progressMsg);

    try {
      if (dryRun) {
        // Dry run: just count
        stats.generated++;
        stats.processed++;
        continue;
      }

      // Generate summary using exposé des motifs if available, else title
      const summary: SummaryResponse = await summarizeDossier({
        title: dossier.title,
        content: dossier.exposeDesMotifs || dossier.title,
        procedure: dossier.category || undefined,
      });

      // Format summary with key points
      const formattedSummary = formatSummary(summary);

      // Update dossier
      await db.legislativeDossier.update({
        where: { id: dossier.id },
        data: {
          summary: formattedSummary,
          summaryDate: new Date(),
        },
      });

      stats.generated++;
      stats.processed++;

      // Rate limiting: 500ms between requests
      if (i < dossiers.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      stats.errors.push(`${dossier.externalId}: ${errorMsg}`);
      stats.processed++;

      // If rate limited, wait longer
      if (errorMsg.includes("429") || errorMsg.includes("rate")) {
        console.log("\n⏳ Rate limited, waiting 30s...");
        await new Promise((resolve) => setTimeout(resolve, 30000));
      }
    }
  }

  // Results
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("\n\n" + "=".repeat(50));
  console.log("Summary Generation Results:");
  console.log("=".repeat(50));
  console.log(`Status: ${stats.errors.length === 0 ? "✅ SUCCESS" : "⚠️ COMPLETED WITH ERRORS"}`);
  console.log(`Duration: ${duration}s`);
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);

  console.log(`\nDossiers:`);
  console.log(`  Processed: ${stats.processed}`);
  console.log(`  Summaries generated: ${stats.generated}`);
  console.log(`  Skipped: ${stats.skipped}`);

  if (stats.errors.length > 0) {
    console.log(`\n⚠️ Errors (${stats.errors.length}):`);
    stats.errors.slice(0, 5).forEach((e) => console.log(`  - ${e}`));
    if (stats.errors.length > 5) {
      console.log(`  ... and ${stats.errors.length - 5} more`);
    }
  }

  // Cost estimate
  const estimatedTokens = stats.generated * 300; // ~300 tokens per summary
  const estimatedCost = (estimatedTokens / 1000000) * 0.25; // Haiku input pricing
  console.log(`\nEstimated cost: $${estimatedCost.toFixed(4)}`);

  console.log("\n" + "=".repeat(50));
}

/**
 * Format summary with key points as markdown
 */
function formatSummary(summary: SummaryResponse): string {
  let formatted = summary.shortSummary;

  if (summary.keyPoints.length > 0) {
    formatted += "\n\n**Points clés :**\n";
    for (const point of summary.keyPoints) {
      formatted += `• ${point}\n`;
    }
  }

  return formatted.trim();
}

/**
 * Show current summary stats
 */
async function showStats() {
  console.log("Fetching summary stats...\n");

  const total = await db.legislativeDossier.count();
  const withSummary = await db.legislativeDossier.count({
    where: { summary: { not: null } },
  });
  const activeWithoutSummary = await db.legislativeDossier.count({
    where: {
      status: "EN_COURS",
      summary: null,
    },
  });

  const recentSummaries = await db.legislativeDossier.findMany({
    where: { summary: { not: null } },
    orderBy: { summaryDate: "desc" },
    take: 3,
    select: { title: true, summary: true, summaryDate: true },
  });

  console.log("Summary Statistics:");
  console.log(`  Total dossiers: ${total}`);
  console.log(`  With summary: ${withSummary} (${((withSummary / total) * 100).toFixed(1)}%)`);
  console.log(`  Active without summary: ${activeWithoutSummary}`);

  if (recentSummaries.length > 0) {
    console.log("\nRecent summaries:");
    for (const d of recentSummaries) {
      const date = d.summaryDate?.toISOString().split("T")[0] || "N/A";
      console.log(`\n  [${date}] ${d.title.substring(0, 60)}...`);
      console.log(`  ${d.summary?.substring(0, 100)}...`);
    }
  }
}

// Main
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Poligraph - AI Summary Generator

Usage:
  npx tsx scripts/generate-summaries.ts              Generate missing summaries
  npx tsx scripts/generate-summaries.ts --force      Regenerate all summaries
  npx tsx scripts/generate-summaries.ts --limit=10   Limit to first N dossiers
  npx tsx scripts/generate-summaries.ts --all        Include non-active dossiers
  npx tsx scripts/generate-summaries.ts --dry-run    Preview without writing
  npx tsx scripts/generate-summaries.ts --stats      Show current stats
  npx tsx scripts/generate-summaries.ts --help       Show this help message

Requirements:
  ANTHROPIC_API_KEY environment variable must be set

Features:
  - Uses Claude Haiku for cost-effective summarization
  - Rate-limited to avoid API throttling
  - Generates short summary + key points for each dossier
  - Estimates API cost after completion
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

  const force = args.includes("--force");
  const dryRun = args.includes("--dry-run");
  const activeOnly = !args.includes("--all");

  await generateSummaries({ force, limit, dryRun, activeOnly });
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
