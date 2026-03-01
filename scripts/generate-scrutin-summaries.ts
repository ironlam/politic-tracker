/**
 * CLI script to generate AI summaries for parliamentary scrutins (votes)
 *
 * Usage:
 *   npx tsx scripts/generate-scrutin-summaries.ts              # Generate missing summaries
 *   npx tsx scripts/generate-scrutin-summaries.ts --force      # Regenerate all summaries
 *   npx tsx scripts/generate-scrutin-summaries.ts --limit=10   # Limit to N scrutins
 *   npx tsx scripts/generate-scrutin-summaries.ts --chamber=AN # Only AN scrutins
 *   npx tsx scripts/generate-scrutin-summaries.ts --dry-run    # Preview without writing
 *   npx tsx scripts/generate-scrutin-summaries.ts --stats      # Show current stats
 *   npx tsx scripts/generate-scrutin-summaries.ts --help       # Show help
 *
 * Requires: ANTHROPIC_API_KEY environment variable
 */

import "dotenv/config";
import { db } from "../src/lib/db";
import { summarizeScrutin, SummaryResponse } from "../src/services/summarize";
import { AI_RATE_LIMIT_MS, AI_429_BACKOFF_MS } from "../src/config/rate-limits";

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
  const bar = "\u2588".repeat(filled) + "\u2591".repeat(empty);
  return `[${bar}] ${percent}%`;
}

/**
 * Format summary with key points as markdown
 */
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

/**
 * Generate summaries for scrutins
 */
async function generateScrutinSummaries(options: {
  force?: boolean;
  limit?: number;
  dryRun?: boolean;
  chamber?: "AN" | "SENAT";
  slug?: string;
  scrutinId?: string;
}) {
  const { force = false, limit, dryRun = false, chamber, slug, scrutinId } = options;

  console.log("=".repeat(50));
  console.log("Poligraph - Scrutin Summary Generator");
  console.log("=".repeat(50));
  console.log(`Mode: ${dryRun ? "DRY RUN (no writes)" : "LIVE"}`);
  console.log(`Force regenerate: ${force ? "Yes" : "No"}`);
  if (slug) console.log(`Slug: ${slug}`);
  if (scrutinId) console.log(`Scrutin ID: ${scrutinId}`);
  if (chamber) console.log(`Chamber: ${chamber}`);
  if (limit) console.log(`Limit: ${limit} scrutins`);
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log("");

  // Check API key
  if (!process.env.ANTHROPIC_API_KEY && !dryRun) {
    console.error("\u274c ANTHROPIC_API_KEY environment variable is not set");
    process.exit(1);
  }

  const startTime = Date.now();
  const stats = {
    processed: 0,
    generated: 0,
    skipped: 0,
    errors: [] as string[],
  };

  // Fetch scrutins needing summaries
  const whereClause: Record<string, unknown> = {};

  if (slug) {
    whereClause.slug = slug;
  } else if (scrutinId) {
    // Accept "Scrutin n°VTANR5L17V5661" or just "VTANR5L17V5661"
    const cleanId = scrutinId.replace(/^Scrutin\s*n°/i, "").trim();
    whereClause.externalId = cleanId;
  }

  if (!force && !slug && !scrutinId) {
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

  const total = scrutins.length;
  console.log(`Found ${total} scrutins to process\n`);

  if (total === 0) {
    console.log("\u2713 No scrutins need summaries");
    return;
  }

  // Process each scrutin
  for (let i = 0; i < scrutins.length; i++) {
    const scrutin = scrutins[i];
    const progressMsg = `${renderProgressBar(i + 1, total)} Processing ${i + 1}/${total}: ${scrutin!.externalId}`;
    updateLine(progressMsg);

    try {
      if (dryRun) {
        stats.generated++;
        stats.processed++;
        continue;
      }

      // Generate summary
      const summary: SummaryResponse = await summarizeScrutin({
        title: scrutin!.title,
        chamber: scrutin!.chamber as "AN" | "SENAT",
        votingDate: scrutin!.votingDate.toISOString().split("T")[0]!,
        result: scrutin!.result as "ADOPTED" | "REJECTED",
        votesFor: scrutin!.votesFor,
        votesAgainst: scrutin!.votesAgainst,
        votesAbstain: scrutin!.votesAbstain,
      });

      // Format summary with key points
      const formattedSummary = formatSummary(summary);

      // Update scrutin
      await db.scrutin.update({
        where: { id: scrutin!.id },
        data: {
          summary: formattedSummary,
          summaryDate: new Date(),
        },
      });

      stats.generated++;
      stats.processed++;

      // Rate limiting between AI requests
      if (i < scrutins.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, AI_RATE_LIMIT_MS));
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      stats.errors.push(`${scrutin!.externalId}: ${errorMsg}`);
      stats.processed++;

      // If rate limited, wait longer
      if (errorMsg.includes("429") || errorMsg.includes("rate")) {
        console.log("\n\u23f3 Rate limited, waiting 30s...");
        await new Promise((resolve) => setTimeout(resolve, AI_429_BACKOFF_MS));
      }
    }
  }

  // Results
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("\n\n" + "=".repeat(50));
  console.log("Scrutin Summary Generation Results:");
  console.log("=".repeat(50));
  console.log(
    `Status: ${stats.errors.length === 0 ? "\u2705 SUCCESS" : "\u26a0\ufe0f COMPLETED WITH ERRORS"}`
  );
  console.log(`Duration: ${duration}s`);
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);

  console.log(`\nScrutins:`);
  console.log(`  Processed: ${stats.processed}`);
  console.log(`  Summaries generated: ${stats.generated}`);
  console.log(`  Skipped: ${stats.skipped}`);

  if (stats.errors.length > 0) {
    console.log(`\n\u26a0\ufe0f Errors (${stats.errors.length}):`);
    stats.errors.slice(0, 5).forEach((e) => console.log(`  - ${e}`));
    if (stats.errors.length > 5) {
      console.log(`  ... and ${stats.errors.length - 5} more`);
    }
  }

  // Cost estimate
  const estimatedTokens = stats.generated * 250; // ~250 tokens per scrutin summary
  const estimatedCost = (estimatedTokens / 1000000) * 0.25; // Haiku input pricing
  console.log(`\nEstimated cost: $${estimatedCost.toFixed(4)}`);

  console.log("\n" + "=".repeat(50));
}

/**
 * Show current summary stats
 */
async function showStats() {
  console.log("Fetching scrutin summary stats...\n");

  const total = await db.scrutin.count();
  const withSummary = await db.scrutin.count({
    where: { summary: { not: null } },
  });
  const anTotal = await db.scrutin.count({ where: { chamber: "AN" } });
  const anWithSummary = await db.scrutin.count({
    where: { chamber: "AN", summary: { not: null } },
  });
  const senatTotal = await db.scrutin.count({ where: { chamber: "SENAT" } });
  const senatWithSummary = await db.scrutin.count({
    where: { chamber: "SENAT", summary: { not: null } },
  });

  const recentSummaries = await db.scrutin.findMany({
    where: { summary: { not: null } },
    orderBy: { summaryDate: "desc" },
    take: 3,
    select: { title: true, summary: true, summaryDate: true, chamber: true },
  });

  console.log("Scrutin Summary Statistics:");
  console.log(`  Total scrutins: ${total}`);
  console.log(
    `  With summary: ${withSummary} (${total > 0 ? ((withSummary / total) * 100).toFixed(1) : 0}%)`
  );
  console.log(
    `  AN: ${anWithSummary}/${anTotal} (${anTotal > 0 ? ((anWithSummary / anTotal) * 100).toFixed(1) : 0}%)`
  );
  console.log(
    `  S\u00e9nat: ${senatWithSummary}/${senatTotal} (${senatTotal > 0 ? ((senatWithSummary / senatTotal) * 100).toFixed(1) : 0}%)`
  );
  console.log(`  Without summary: ${total - withSummary}`);

  if (recentSummaries.length > 0) {
    console.log("\nRecent summaries:");
    for (const s of recentSummaries) {
      const date = s.summaryDate?.toISOString().split("T")[0] || "N/A";
      const chamber = s.chamber === "AN" ? "AN" : "S\u00e9nat";
      console.log(`\n  [${date}] [${chamber}] ${s.title.substring(0, 60)}...`);
      console.log(`  ${s.summary?.substring(0, 100)}...`);
    }
  }
}

// Main
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Poligraph - Scrutin Summary Generator

Usage:
  npx tsx scripts/generate-scrutin-summaries.ts                        Generate missing summaries
  npx tsx scripts/generate-scrutin-summaries.ts --id=VTANR5L17V5661    Generate for a specific scrutin ID
  npx tsx scripts/generate-scrutin-summaries.ts --id="Scrutin n°VTANR5L17V5661"  Also works with full label
  npx tsx scripts/generate-scrutin-summaries.ts --slug=2026-02-23-...  Generate for a specific slug
  npx tsx scripts/generate-scrutin-summaries.ts --force                Regenerate all summaries
  npx tsx scripts/generate-scrutin-summaries.ts --limit=10             Limit to first N scrutins
  npx tsx scripts/generate-scrutin-summaries.ts --chamber=AN           Only AN scrutins
  npx tsx scripts/generate-scrutin-summaries.ts --chamber=SENAT        Only Sénat scrutins
  npx tsx scripts/generate-scrutin-summaries.ts --dry-run              Preview without writing
  npx tsx scripts/generate-scrutin-summaries.ts --stats                Show current stats
  npx tsx scripts/generate-scrutin-summaries.ts --help                 Show this help message

Requirements:
  ANTHROPIC_API_KEY environment variable must be set

Features:
  - Uses Claude Haiku for cost-effective summarization
  - Rate-limited to avoid API throttling
  - Generates short summary + key points for each scrutin
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
    limit = parseInt(limitArg.split("=")[1]!, 10);
    if (isNaN(limit) || limit < 1) {
      console.error("Invalid limit number");
      process.exit(1);
    }
  }

  let chamber: "AN" | "SENAT" | undefined;
  const chamberArg = args.find((a) => a.startsWith("--chamber="));
  if (chamberArg) {
    const value = chamberArg.split("=")[1]!.toUpperCase();
    if (value !== "AN" && value !== "SENAT") {
      console.error("Invalid chamber. Use --chamber=AN or --chamber=SENAT");
      process.exit(1);
    }
    chamber = value;
  }

  const slugArg = args.find((a) => a.startsWith("--slug="));
  const slug = slugArg ? slugArg.split("=")[1] : undefined;

  const idArg = args.find((a) => a.startsWith("--id="));
  const scrutinId = idArg ? idArg.split("=").slice(1).join("=") : undefined;

  const force = args.includes("--force");
  const dryRun = args.includes("--dry-run");

  await generateScrutinSummaries({ force, limit, dryRun, chamber, slug, scrutinId });
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
