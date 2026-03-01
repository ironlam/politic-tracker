/**
 * CLI script to generate AI biographies for politicians
 *
 * Usage:
 *   npx tsx scripts/generate-biographies.ts              # Generate missing biographies
 *   npx tsx scripts/generate-biographies.ts --force      # Regenerate all biographies
 *   npx tsx scripts/generate-biographies.ts --limit=10   # Limit to N politicians
 *   npx tsx scripts/generate-biographies.ts --dry-run    # Preview without writing
 *   npx tsx scripts/generate-biographies.ts --stats      # Show current stats
 *   npx tsx scripts/generate-biographies.ts --help       # Show help
 *
 * Requires: ANTHROPIC_API_KEY environment variable
 */

import "dotenv/config";
import { db } from "../src/lib/db";
import { generateBiography, BiographyRequest } from "../src/services/summarize";
import { MANDATE_TYPE_LABELS } from "../src/config/labels";
import { MandateType } from "../src/generated/prisma";
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
 * Build a mandate title with proper label
 */
function mandateTitle(mandate: {
  type: string;
  title: string | null;
  institution: string | null;
}): string {
  const label = MANDATE_TYPE_LABELS[mandate.type as MandateType] || mandate.type;
  if (mandate.title) return mandate.title;
  if (mandate.institution) return `${label} — ${mandate.institution}`;
  return label;
}

/**
 * Generate biographies for politicians
 */
async function generateBiographies(options: { force?: boolean; limit?: number; dryRun?: boolean }) {
  const { force = false, limit, dryRun = false } = options;

  console.log("=".repeat(50));
  console.log("Poligraph - Biography Generator");
  console.log("=".repeat(50));
  console.log(`Mode: ${dryRun ? "DRY RUN (no writes)" : "LIVE"}`);
  console.log(`Force regenerate: ${force ? "Yes" : "No"}`);
  if (limit) console.log(`Limit: ${limit} politicians`);
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

  // Fetch politicians needing biographies
  const whereClause: Record<string, unknown> = {};

  if (!force) {
    whereClause.biography = null;
  }

  let politicians = await db.politician.findMany({
    where: whereClause,
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      slug: true,
      fullName: true,
      civility: true,
      birthDate: true,
      birthPlace: true,
      deathDate: true,
      currentParty: { select: { name: true } },
      mandates: {
        select: {
          type: true,
          title: true,
          institution: true,
          isCurrent: true,
          startDate: true,
          endDate: true,
        },
        orderBy: { startDate: "desc" },
      },
      declarations: {
        select: { year: true },
        orderBy: { year: "desc" },
      },
      _count: {
        select: {
          affairs: true,
          votes: true,
        },
      },
    },
  });

  if (limit) {
    politicians = politicians.slice(0, limit);
  }

  const total = politicians.length;
  console.log(`Found ${total} politicians to process\n`);

  if (total === 0) {
    console.log("\u2713 All politicians already have biographies");
    return;
  }

  // Get vote stats for all politicians at once
  const voteStatsByPolitician = new Map<
    string,
    { total: number; pour: number; contre: number; abstention: number }
  >();

  const voteStats = await db.vote.groupBy({
    by: ["politicianId", "position"],
    _count: true,
  });

  for (const vs of voteStats) {
    const existing = voteStatsByPolitician.get(vs.politicianId) || {
      total: 0,
      pour: 0,
      contre: 0,
      abstention: 0,
    };
    existing.total += vs._count;
    switch (vs.position) {
      case "POUR":
        existing.pour += vs._count;
        break;
      case "CONTRE":
        existing.contre += vs._count;
        break;
      case "ABSTENTION":
        existing.abstention += vs._count;
        break;
    }
    voteStatsByPolitician.set(vs.politicianId, existing);
  }

  // Process each politician
  for (let i = 0; i < politicians.length; i++) {
    const pol = politicians[i];
    const progressMsg = `${renderProgressBar(i + 1, total)} Processing ${i + 1}/${total}: ${pol!.fullName}`;
    updateLine(progressMsg);

    try {
      const bioRequest: BiographyRequest = {
        fullName: pol!.fullName,
        civility: pol!.civility,
        birthDate: pol!.birthDate,
        birthPlace: pol!.birthPlace,
        deathDate: pol!.deathDate,
        currentParty: pol!.currentParty?.name || null,
        mandates: pol!.mandates.map((m) => ({
          type: m.type,
          title: mandateTitle(m),
          isCurrent: m.isCurrent,
          startDate: m.startDate,
          endDate: m.endDate,
        })),
        voteStats: voteStatsByPolitician.get(pol!.id) || null,
        affairsCount: pol!._count.affairs,
        declarationsCount: pol!.declarations.length,
        latestDeclarationYear: pol!.declarations.length > 0 ? pol!.declarations[0]!.year : null,
      };

      if (dryRun) {
        if (i < 3) {
          console.log(`\n\n--- ${pol!.fullName} ---`);
          console.log(`  Mandats: ${pol!.mandates.length}`);
          console.log(`  Votes: ${voteStatsByPolitician.get(pol!.id)?.total || 0}`);
          console.log(`  Déclarations HATVP: ${pol!.declarations.length}`);
          console.log(`  Affaires: ${pol!._count.affairs}`);
        }
        stats.generated++;
        stats.processed++;
        continue;
      }

      // Generate biography
      const biography = await generateBiography(bioRequest);

      // Save to database
      await db.politician.update({
        where: { id: pol!.id },
        data: {
          biography,
          biographyGeneratedAt: new Date(),
        },
      });

      stats.generated++;
      stats.processed++;

      // Rate limiting between AI requests
      if (i < politicians.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, AI_RATE_LIMIT_MS));
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      stats.errors.push(`${pol!.fullName}: ${errorMsg}`);
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
  console.log("Biography Generation Results:");
  console.log("=".repeat(50));
  console.log(
    `Status: ${stats.errors.length === 0 ? "\u2705 SUCCESS" : "\u26a0\ufe0f COMPLETED WITH ERRORS"}`
  );
  console.log(`Duration: ${duration}s`);
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);

  console.log(`\nPoliticians:`);
  console.log(`  Processed: ${stats.processed}`);
  console.log(`  Biographies generated: ${stats.generated}`);
  console.log(`  Skipped: ${stats.skipped}`);

  if (stats.errors.length > 0) {
    console.log(`\n\u26a0\ufe0f Errors (${stats.errors.length}):`);
    stats.errors.slice(0, 5).forEach((e) => console.log(`  - ${e}`));
    if (stats.errors.length > 5) {
      console.log(`  ... and ${stats.errors.length - 5} more`);
    }
  }

  // Cost estimate
  const estimatedTokens = stats.generated * 400; // ~400 tokens per biography
  const estimatedCost = (estimatedTokens / 1000000) * 0.25; // Haiku input pricing
  console.log(`\nEstimated cost: $${estimatedCost.toFixed(4)}`);

  console.log("\n" + "=".repeat(50));
}

/**
 * Show current biography stats
 */
async function showStats() {
  console.log("Fetching biography stats...\n");

  const total = await db.politician.count();
  const withBio = await db.politician.count({
    where: { biography: { not: null } },
  });
  const withCurrentMandate = await db.politician.count({
    where: { mandates: { some: { isCurrent: true } } },
  });
  const withBioAndMandate = await db.politician.count({
    where: {
      biography: { not: null },
      mandates: { some: { isCurrent: true } },
    },
  });

  const recentBios = await db.politician.findMany({
    where: { biography: { not: null } },
    orderBy: { biographyGeneratedAt: "desc" },
    take: 3,
    select: {
      fullName: true,
      biography: true,
      biographyGeneratedAt: true,
    },
  });

  console.log("Biography Statistics:");
  console.log(`  Total politicians: ${total}`);
  console.log(
    `  With biography: ${withBio} (${total > 0 ? ((withBio / total) * 100).toFixed(1) : 0}%)`
  );
  console.log(`  Without biography: ${total - withBio}`);
  console.log(`  Active politicians with bio: ${withBioAndMandate}/${withCurrentMandate}`);

  if (recentBios.length > 0) {
    console.log("\nRecent biographies:");
    for (const p of recentBios) {
      const date = p.biographyGeneratedAt?.toISOString().split("T")[0] || "N/A";
      console.log(`\n  [${date}] ${p.fullName}`);
      console.log(`  ${p.biography?.substring(0, 120)}...`);
    }
  }
}

// Main
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Poligraph - Biography Generator

Usage:
  npx tsx scripts/generate-biographies.ts              Generate missing biographies
  npx tsx scripts/generate-biographies.ts --force      Regenerate all biographies
  npx tsx scripts/generate-biographies.ts --limit=10   Limit to first N politicians
  npx tsx scripts/generate-biographies.ts --dry-run    Preview without writing
  npx tsx scripts/generate-biographies.ts --stats      Show current stats
  npx tsx scripts/generate-biographies.ts --help       Show this help message

Requirements:
  ANTHROPIC_API_KEY environment variable must be set

Features:
  - Uses Claude Haiku for cost-effective biography generation
  - Rate-limited to avoid API throttling
  - Generates 100-200 word factual biographies from database data
  - Does NOT mention judicial affairs (defamation risk)
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

  const force = args.includes("--force");
  const dryRun = args.includes("--dry-run");

  await generateBiographies({ force, limit, dryRun });
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
