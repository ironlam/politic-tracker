/**
 * Batch AI generation of citizen impact explanations for parliamentary votes.
 *
 * Generates "Ce que ça change pour vous" explanations that translate
 * parliamentary jargon into plain French for citizens.
 *
 * Usage:
 *   npx dotenv -e .env -- npx tsx scripts/generate-citizen-impact.ts --dry-run
 *   npx dotenv -e .env -- npx tsx scripts/generate-citizen-impact.ts --limit=10
 *   npx dotenv -e .env -- npx tsx scripts/generate-citizen-impact.ts --force
 *   npx dotenv -e .env -- npx tsx scripts/generate-citizen-impact.ts --stats
 *   npx dotenv -e .env -- npx tsx scripts/generate-citizen-impact.ts --recent-sonnet=200
 *   npx dotenv -e .env -- npx tsx scripts/generate-citizen-impact.ts --skip-scrape
 *   npx dotenv -e .env -- npx tsx scripts/generate-citizen-impact.ts --chamber=AN
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import {
  generateCitizenImpact,
  SONNET_MODEL,
  HAIKU_MODEL,
  type CitizenImpactInput,
} from "../src/services/scrutin-citizen-impact";
import { fetchScrutinContext } from "../src/services/scrutin-context-fetcher";
import { AI_RATE_LIMIT_MS, AI_429_BACKOFF_MS } from "../src/config/rate-limits";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  ssl: { rejectUnauthorized: false },
  allowExitOnIdle: true,
});
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

// Progress display
const isTTY = process.stdout.isTTY === true;
let lastLen = 0;

function updateLine(msg: string): void {
  if (isTTY) {
    process.stdout.write(`\r\x1b[K${msg}`);
  } else {
    process.stdout.write(`\r${msg}${" ".repeat(Math.max(0, lastLen - msg.length))}`);
  }
  lastLen = msg.length;
}

function progressBar(current: number, total: number, width = 30): string {
  const pct = Math.round((current / total) * 100);
  const filled = Math.round((current / total) * width);
  return `[${"█".repeat(filled)}${"░".repeat(width - filled)}] ${pct}%`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// STATS MODE
// ============================================

async function showStats() {
  const total = await db.scrutin.count();
  const withSummary = await db.scrutin.count({
    where: { summary: { not: null } },
  });
  const withImpact = await db.scrutin.count({
    where: { citizenImpact: { not: null } },
  });

  const byResult = await db.scrutin.groupBy({
    by: ["result"],
    _count: true,
  });

  const byChamber = await db.scrutin.groupBy({
    by: ["chamber"],
    _count: true,
  });

  console.log("Scrutin Citizen Impact Stats:");
  console.log(`  Total scrutins: ${total}`);
  console.log(
    `  With summary: ${withSummary} (${total > 0 ? ((withSummary / total) * 100).toFixed(1) : 0}%)`
  );
  console.log(
    `  With citizen impact: ${withImpact} (${total > 0 ? ((withImpact / total) * 100).toFixed(1) : 0}%)`
  );

  console.log("\n  By result:");
  for (const r of byResult) {
    console.log(`    ${r.result}: ${r._count}`);
  }

  console.log("\n  By chamber:");
  for (const c of byChamber) {
    console.log(`    ${c.chamber}: ${c._count}`);
  }

  if (withImpact > 0) {
    const recent = await db.scrutin.findMany({
      where: { citizenImpact: { not: null } },
      orderBy: { citizenImpactDate: "desc" },
      take: 3,
      select: { title: true, citizenImpactDate: true, citizenImpact: true },
    });
    console.log("\nRecent citizen impacts:");
    for (const s of recent) {
      console.log(
        `  [${s.citizenImpactDate?.toISOString().split("T")[0]}] ${s.title.slice(0, 60)}...`
      );
      console.log(`    ${s.citizenImpact?.slice(0, 120)}...`);
    }
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Poligraph - Citizen Impact Generation

Usage:
  npx tsx scripts/generate-citizen-impact.ts              Generate citizen impact
  npx tsx scripts/generate-citizen-impact.ts --dry-run    Preview without writing
  npx tsx scripts/generate-citizen-impact.ts --limit=10   Limit to N scrutins
  npx tsx scripts/generate-citizen-impact.ts --force       Re-generate existing
  npx tsx scripts/generate-citizen-impact.ts --stats       Show current stats
  npx tsx scripts/generate-citizen-impact.ts --verbose     Detailed output
  npx tsx scripts/generate-citizen-impact.ts --chamber=AN  Filter by chamber (AN|SENAT)
  npx tsx scripts/generate-citizen-impact.ts --recent-sonnet=200  Use Sonnet for N most recent
  npx tsx scripts/generate-citizen-impact.ts --skip-scrape Don't fetch sourceUrls

Requirements:
  ANTHROPIC_API_KEY environment variable must be set
    `);
    return;
  }

  if (args.includes("--stats")) {
    await showStats();
    return;
  }

  const dryRun = args.includes("--dry-run");
  const force = args.includes("--force");
  const verbose = args.includes("--verbose");
  const skipScrape = args.includes("--skip-scrape");
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1]!, 10) : undefined;
  const chamberArg = args.find((a) => a.startsWith("--chamber="));
  const chamber = chamberArg
    ? (chamberArg.split("=")[1]!.toUpperCase() as "AN" | "SENAT")
    : undefined;
  const sonnetArg = args.find((a) => a.startsWith("--recent-sonnet="));
  const recentSonnetCount = sonnetArg ? parseInt(sonnetArg.split("=")[1]!, 10) : 0;

  console.log("=".repeat(50));
  console.log("Poligraph - Citizen Impact Generation");
  console.log("=".repeat(50));
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`Force: ${force}`);
  console.log(`Skip scrape: ${skipScrape}`);
  if (chamber) console.log(`Chamber: ${chamber}`);
  if (recentSonnetCount) console.log(`Sonnet for ${recentSonnetCount} most recent`);
  if (limit) console.log(`Limit: ${limit}`);
  console.log();

  if (!process.env.ANTHROPIC_API_KEY && !dryRun) {
    console.error("ANTHROPIC_API_KEY is not set");
    process.exit(1);
  }

  // Build where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (!force) where.citizenImpact = null;
  if (chamber) where.chamber = chamber;
  // Only process scrutins that have a summary (they're all meaningful)
  where.summary = { not: null };

  // Fetch scrutins ordered by votingDate desc (most recent first for --recent-sonnet)
  let scrutins = await db.scrutin.findMany({
    where,
    select: {
      id: true,
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
    },
    orderBy: { votingDate: "desc" },
  });

  if (limit) scrutins = scrutins.slice(0, limit);

  console.log(`Found ${scrutins.length} scrutins to process\n`);

  if (scrutins.length === 0) {
    console.log("Nothing to generate.");
    return;
  }

  const stats = {
    processed: 0,
    generated: 0,
    skipped: 0,
    contextHits: 0,
    sonnetUsed: 0,
    haikuUsed: 0,
    errors: [] as string[],
  };
  const startTime = Date.now();

  for (let i = 0; i < scrutins.length; i++) {
    const scrutin = scrutins[i]!;
    const useSonnet = i < recentSonnetCount;
    const modelLabel = useSonnet ? "S" : "H";

    updateLine(
      `${progressBar(i + 1, scrutins.length)} ${i + 1}/${scrutins.length} [${modelLabel}]: ${scrutin.title.slice(0, 40)}...`
    );

    if (dryRun) {
      if (verbose || i < 3) {
        // Fetch context even in dry-run to show what we'd use
        const context = await fetchScrutinContext(scrutin.title, scrutin.sourceUrl, db, {
          skipScrape: true,
        });
        console.log(`\n\n--- ${scrutin.title.slice(0, 80)} ---`);
        console.log(`  Result: ${scrutin.result} | Chamber: ${scrutin.chamber}`);
        console.log(`  Model: ${useSonnet ? "Sonnet 4.6" : "Haiku 4.5"}`);
        console.log(`  Summary: ${scrutin.summary?.slice(0, 80)}...`);
        console.log(
          `  Dossier match: ${context.dossierTitle ? context.dossierTitle.slice(0, 60) : "none"}`
        );
      }
      stats.generated++;
      stats.processed++;
      continue;
    }

    try {
      // 1. Fetch enriched context
      const context = await fetchScrutinContext(scrutin.title, scrutin.sourceUrl, db, {
        skipScrape,
      });

      if (context.dossierTitle || context.sourcePageText) {
        stats.contextHits++;
      }

      // 2. Build input
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
        links: {
          dossierUrl: context.dossierSlug ? `/assemblee/${context.dossierSlug}` : null,
          dossierLabel: context.dossierTitle ?? null,
          relatedVotes: [],
          politicians: [],
        },
      };

      // 3. Generate
      const model = useSonnet ? SONNET_MODEL : HAIKU_MODEL;
      const result = await generateCitizenImpact(input, model);

      if (useSonnet) stats.sonnetUsed++;
      else stats.haikuUsed++;

      // 4. Skip low-confidence (procedural votes)
      if (result.confidence < 40) {
        if (verbose) {
          console.log(
            `\n  Skipped (confidence ${result.confidence}): ${scrutin.title.slice(0, 60)}`
          );
        }
        stats.skipped++;
        stats.processed++;
        continue;
      }

      // 5. Update DB
      await db.scrutin.update({
        where: { id: scrutin.id },
        data: {
          citizenImpact: result.citizenImpact,
          citizenImpactDate: new Date(),
        },
      });

      if (verbose) {
        console.log(
          `\n  Generated (${result.confidence}%, ${modelLabel}): ${result.citizenImpact.slice(0, 80)}...`
        );
      }

      stats.generated++;
      stats.processed++;

      // Rate limit
      if (i < scrutins.length - 1) {
        await sleep(AI_RATE_LIMIT_MS);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      stats.errors.push(`${scrutin.title.slice(0, 50)}: ${msg}`);
      stats.processed++;

      if (msg.includes("429") || msg.includes("rate")) {
        console.log("\n  Rate limited, waiting 30s...");
        await sleep(AI_429_BACKOFF_MS);
      }
    }
  }

  // Results
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n\n" + "=".repeat(50));
  console.log("Results:");
  console.log("=".repeat(50));
  console.log(`Duration: ${duration}s`);
  console.log(`Processed: ${stats.processed}`);
  console.log(`Generated: ${stats.generated}`);
  console.log(`Skipped (low confidence): ${stats.skipped}`);
  console.log(`Context hits (dossier/scrape): ${stats.contextHits}`);
  if (recentSonnetCount) {
    console.log(`Sonnet calls: ${stats.sonnetUsed} | Haiku calls: ${stats.haikuUsed}`);
  }

  if (stats.errors.length > 0) {
    console.log(`\nErrors (${stats.errors.length}):`);
    stats.errors.slice(0, 5).forEach((e) => console.log(`  - ${e}`));
    if (stats.errors.length > 5) console.log(`  ... and ${stats.errors.length - 5} more`);
  }

  // Cost estimate
  // Haiku 4.5: $0.80/MTok input, $4.00/MTok output
  // Sonnet 4.6: $3.00/MTok input, $15.00/MTok output
  const haikuInputTokens = stats.haikuUsed * 800;
  const haikuOutputTokens = stats.haikuUsed * 400;
  const sonnetInputTokens = stats.sonnetUsed * 800;
  const sonnetOutputTokens = stats.sonnetUsed * 400;
  const cost =
    (haikuInputTokens / 1_000_000) * 0.8 +
    (haikuOutputTokens / 1_000_000) * 4.0 +
    (sonnetInputTokens / 1_000_000) * 3.0 +
    (sonnetOutputTokens / 1_000_000) * 15.0;
  console.log(`\nEstimated cost: $${cost.toFixed(3)}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
