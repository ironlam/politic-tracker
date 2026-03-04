/**
 * Batch AI enrichment of affair descriptions.
 *
 * Enriches thin descriptions (< 500 chars) with contextual text + internal links.
 * Uses Haiku 4.5 for cost-effective generation from existing DB data (no web search).
 *
 * Usage:
 *   npx dotenv -e .env -- npx tsx scripts/enrich-affair-descriptions.ts --dry-run
 *   npx dotenv -e .env -- npx tsx scripts/enrich-affair-descriptions.ts --limit=10
 *   npx dotenv -e .env -- npx tsx scripts/enrich-affair-descriptions.ts --force
 *   npx dotenv -e .env -- npx tsx scripts/enrich-affair-descriptions.ts --stats
 *   npx dotenv -e .env -- npx tsx scripts/enrich-affair-descriptions.ts --max-chars=500
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import {
  enrichDescription,
  type DescriptionEnrichmentInput,
} from "../src/services/affair-description-enrichment";
import { MANDATE_TYPE_LABELS } from "../src/config/labels";
import type { MandateType } from "../src/generated/prisma";
import { AI_RATE_LIMIT_MS, AI_429_BACKOFF_MS } from "../src/config/rate-limits";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  ssl: { rejectUnauthorized: false },
  allowExitOnIdle: true,
});
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

// Progress
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
  const total = await db.affair.count({ where: { publicationStatus: "PUBLISHED" } });
  const enriched = await db.affair.count({
    where: { publicationStatus: "PUBLISHED", descriptionEnrichedAt: { not: null } },
  });

  const affairs = await db.affair.findMany({
    where: { publicationStatus: "PUBLISHED" },
    select: { description: true, descriptionEnrichedAt: true },
  });

  const lengths = affairs.map((a) => a.description.length);
  const avg = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
  const under200 = lengths.filter((l) => l < 200).length;
  const under500 = lengths.filter((l) => l < 500).length;

  console.log("Affair Description Stats:");
  console.log(`  Total published: ${total}`);
  console.log(
    `  AI-enriched: ${enriched} (${total > 0 ? ((enriched / total) * 100).toFixed(1) : 0}%)`
  );
  console.log(`  Avg length: ${avg} chars`);
  console.log(`  < 200 chars: ${under200}`);
  console.log(`  < 500 chars: ${under500}`);
  console.log(`  >= 500 chars: ${lengths.filter((l) => l >= 500).length}`);

  if (enriched > 0) {
    const recent = await db.affair.findMany({
      where: { descriptionEnrichedAt: { not: null } },
      orderBy: { descriptionEnrichedAt: "desc" },
      take: 3,
      select: { title: true, descriptionEnrichedAt: true, description: true },
    });
    console.log("\nRecent enrichments:");
    for (const a of recent) {
      console.log(`  [${a.descriptionEnrichedAt?.toISOString().split("T")[0]}] ${a.title}`);
      console.log(`  ${a.description.slice(0, 100)}...`);
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
Poligraph - Affair Description Enrichment

Usage:
  npx tsx scripts/enrich-affair-descriptions.ts              Enrich short descriptions
  npx tsx scripts/enrich-affair-descriptions.ts --dry-run    Preview without writing
  npx tsx scripts/enrich-affair-descriptions.ts --limit=10   Limit to N affairs
  npx tsx scripts/enrich-affair-descriptions.ts --force      Re-enrich already enriched
  npx tsx scripts/enrich-affair-descriptions.ts --stats      Show current stats
  npx tsx scripts/enrich-affair-descriptions.ts --max-chars=500  Override char threshold

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
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1]!, 10) : undefined;
  const maxCharsArg = args.find((a) => a.startsWith("--max-chars="));
  const maxChars = maxCharsArg ? parseInt(maxCharsArg.split("=")[1]!, 10) : 500;

  console.log("=".repeat(50));
  console.log("Poligraph - Description Enrichment");
  console.log("=".repeat(50));
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`Force: ${force}`);
  console.log(`Max chars threshold: ${maxChars}`);
  if (limit) console.log(`Limit: ${limit}`);
  console.log();

  if (!process.env.ANTHROPIC_API_KEY && !dryRun) {
    console.error("ANTHROPIC_API_KEY is not set");
    process.exit(1);
  }

  // Fetch all PUBLISHED affairs with context
  const allAffairs = await db.affair.findMany({
    where: {
      publicationStatus: "PUBLISHED",
      ...(force ? {} : { descriptionEnrichedAt: null }),
    },
    include: {
      politician: {
        select: {
          fullName: true,
          slug: true,
          civility: true,
          currentParty: { select: { shortName: true, name: true, slug: true } },
          mandates: {
            where: { isCurrent: true },
            select: { type: true, title: true, institution: true },
          },
          affairs: {
            where: { publicationStatus: "PUBLISHED" },
            select: { id: true, title: true, slug: true },
            take: 10,
          },
        },
      },
      partyAtTime: { select: { shortName: true, name: true, slug: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Filter by description length (Prisma can't filter by string length)
  let affairs = allAffairs.filter((a) => a.description.length < maxChars);

  if (limit) affairs = affairs.slice(0, limit);

  console.log(`Found ${affairs.length} affairs to enrich (< ${maxChars} chars)\n`);

  if (affairs.length === 0) {
    console.log("Nothing to enrich.");
    return;
  }

  const stats = { processed: 0, enriched: 0, skipped: 0, errors: [] as string[] };
  const startTime = Date.now();

  for (let i = 0; i < affairs.length; i++) {
    const affair = affairs[i]!;
    updateLine(
      `${progressBar(i + 1, affairs.length)} ${i + 1}/${affairs.length}: ${affair.title.slice(0, 40)}...`
    );

    // Build other affairs (exclude current)
    const otherAffairs = affair.politician.affairs
      .filter((a) => a.id !== affair.id)
      .slice(0, 5)
      .map((a) => ({ title: a.title, slug: a.slug }));

    const mandateLabels = affair.politician.mandates.map((m) => {
      const label = MANDATE_TYPE_LABELS[m.type as MandateType] || m.type;
      return m.title || (m.institution ? `${label} — ${m.institution}` : label);
    });

    const input: DescriptionEnrichmentInput = {
      title: affair.title,
      description: affair.description,
      status: affair.status,
      category: affair.category,
      involvement: affair.involvement,
      factsDate: affair.factsDate?.toISOString().split("T")[0] ?? null,
      verdictDate: affair.verdictDate?.toISOString().split("T")[0] ?? null,
      court: affair.court,
      prisonMonths: affair.prisonMonths,
      prisonSuspended: affair.prisonSuspended,
      fineAmount: affair.fineAmount ? Number(affair.fineAmount) : null,
      ineligibilityMonths: affair.ineligibilityMonths,
      communityService: affair.communityService,
      otherSentence: affair.otherSentence,
      sentence: affair.sentence,
      politicianFullName: affair.politician.fullName,
      politicianSlug: affair.politician.slug,
      politicianCivility: affair.politician.civility,
      currentMandates: mandateLabels,
      partyAtTimeName: affair.partyAtTime?.name ?? null,
      partyAtTimeSlug: affair.partyAtTime?.slug ?? null,
      currentPartyName: affair.politician.currentParty?.name ?? null,
      currentPartySlug: affair.politician.currentParty?.slug ?? null,
      otherAffairs,
    };

    if (dryRun) {
      if (verbose || i < 3) {
        console.log(`\n\n--- ${affair.politician.fullName} — ${affair.title} ---`);
        console.log(
          `  Current (${affair.description.length} chars): ${affair.description.slice(0, 100)}...`
        );
        console.log(`  Mandates: ${mandateLabels.join(", ") || "none"}`);
        console.log(`  Party: ${input.partyAtTimeName || input.currentPartyName || "unknown"}`);
        console.log(`  Other affairs: ${otherAffairs.length}`);
      }
      stats.enriched++;
      stats.processed++;
      continue;
    }

    try {
      const result = await enrichDescription(input);

      if (result.confidence < 50) {
        if (verbose) console.log(`\n  Skipped (confidence ${result.confidence}): ${affair.title}`);
        stats.skipped++;
        stats.processed++;
        continue;
      }

      // Update DB
      await db.affair.update({
        where: { id: affair.id },
        data: {
          originalDescription: affair.description,
          description: result.enrichedDescription,
          descriptionEnrichedAt: new Date(),
        },
      });

      // Audit log
      await db.auditLog.create({
        data: {
          action: "UPDATE",
          entityType: "Affair",
          entityId: affair.id,
          changes: {
            source: "ai-description-enrichment",
            confidence: result.confidence,
            originalLength: affair.description.length,
            enrichedLength: result.enrichedDescription.length,
          },
        },
      });

      if (verbose) {
        console.log(
          `\n  Enriched (${result.confidence}%): ${affair.description.length} → ${result.enrichedDescription.length} chars`
        );
      }

      stats.enriched++;
      stats.processed++;

      // Rate limit
      if (i < affairs.length - 1) {
        await sleep(AI_RATE_LIMIT_MS);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      stats.errors.push(`${affair.title}: ${msg}`);
      stats.processed++;

      if (msg.includes("429") || msg.includes("rate")) {
        console.log("\n⏳ Rate limited, waiting 30s...");
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
  console.log(`Enriched: ${stats.enriched}`);
  console.log(`Skipped (low confidence): ${stats.skipped}`);

  if (stats.errors.length > 0) {
    console.log(`\nErrors (${stats.errors.length}):`);
    stats.errors.slice(0, 5).forEach((e) => console.log(`  - ${e}`));
    if (stats.errors.length > 5) console.log(`  ... and ${stats.errors.length - 5} more`);
  }

  // Cost estimate (Haiku 4.5: $0.80/MTok input, $4.00/MTok output)
  const inputTokens = stats.enriched * 500;
  const outputTokens = stats.enriched * 600;
  const cost = (inputTokens / 1_000_000) * 0.8 + (outputTokens / 1_000_000) * 4.0;
  console.log(`\nEstimated cost: $${cost.toFixed(3)}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
