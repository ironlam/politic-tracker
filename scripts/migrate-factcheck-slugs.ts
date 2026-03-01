/**
 * Migration script to generate SEO-friendly slugs for existing FactChecks
 *
 * Usage:
 *   npx tsx scripts/migrate-factcheck-slugs.ts              # Run migration
 *   npx tsx scripts/migrate-factcheck-slugs.ts --dry-run    # Preview without writing
 *   npx tsx scripts/migrate-factcheck-slugs.ts --stats      # Show current stats
 *   npx tsx scripts/migrate-factcheck-slugs.ts --help       # Show help
 */

import "dotenv/config";
import { db } from "../src/lib/db";
import { generateDateSlug } from "../src/lib/utils";

// Parse arguments
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const showStats = args.includes("--stats");
const showHelp = args.includes("--help");

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
  const bar = "=".repeat(filled) + "-".repeat(empty);
  return `[${bar}] ${percent}%`;
}

/**
 * Generate a unique slug, handling duplicates with suffix
 */
async function getUniqueSlug(
  baseSlug: string,
  existingSlugs: Set<string>,
  checkDb: (slug: string) => Promise<boolean>
): Promise<string> {
  let slug = baseSlug;
  let counter = 2;

  while (existingSlugs.has(slug) || (await checkDb(slug))) {
    const suffix = `-${counter}`;
    const maxBaseLength = 80 - suffix.length;
    const truncatedBase = baseSlug.slice(0, maxBaseLength).replace(/-$/, "");
    slug = `${truncatedBase}${suffix}`;
    counter++;
  }

  existingSlugs.add(slug);
  return slug;
}

/**
 * Migrate fact-checks to have slugs
 */
async function migrateFactChecks(): Promise<{ updated: number; skipped: number }> {
  console.log("\n📋 Migrating FactChecks...\n");

  const factChecks = await db.factCheck.findMany({
    where: { slug: null },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      title: true,
      publishedAt: true,
      source: true,
    },
  });

  if (factChecks.length === 0) {
    console.log("✓ All fact-checks already have slugs\n");
    return { updated: 0, skipped: 0 };
  }

  console.log(`Found ${factChecks.length} fact-checks without slugs\n`);

  const existingSlugs = new Set<string>();
  let updated = 0;
  let skipped = 0;

  // Load existing slugs
  const existing = await db.factCheck.findMany({
    where: { slug: { not: null } },
    select: { slug: true },
  });
  for (const fc of existing) {
    if (fc.slug) existingSlugs.add(fc.slug);
  }

  for (let i = 0; i < factChecks.length; i++) {
    const fc = factChecks[i];
    updateLine(
      `${renderProgressBar(i + 1, factChecks.length)} Processing ${fc!.source} - ${fc!.title.slice(0, 40)}...`
    );

    try {
      const baseSlug = generateDateSlug(fc!.publishedAt, fc!.title);
      const uniqueSlug = await getUniqueSlug(baseSlug, existingSlugs, async (slug) => {
        const exists = await db.factCheck.findUnique({ where: { slug } });
        return exists !== null;
      });

      if (dryRun) {
        console.log(`\n  [DRY RUN] ${fc!.title.slice(0, 60)} → ${uniqueSlug}`);
      } else {
        await db.factCheck.update({
          where: { id: fc!.id },
          data: { slug: uniqueSlug },
        });
      }
      updated++;
    } catch (error) {
      console.error(`\n  Error processing ${fc!.id}:`, error);
      skipped++;
    }
  }

  console.log(`\n\n✓ FactChecks: ${updated} updated, ${skipped} skipped\n`);
  return { updated, skipped };
}

/**
 * Show statistics
 */
async function showStatistics(): Promise<void> {
  console.log("\n📊 FactCheck Slug Migration Statistics\n");

  const [totalFactChecks, withSlug] = await Promise.all([
    db.factCheck.count(),
    db.factCheck.count({ where: { slug: { not: null } } }),
  ]);

  console.log("FactChecks:");
  console.log(`  Total: ${totalFactChecks}`);
  console.log(`  With slug: ${withSlug}`);
  console.log(`  Without slug: ${totalFactChecks - withSlug}`);
  console.log(
    `  Coverage: ${totalFactChecks > 0 ? ((withSlug / totalFactChecks) * 100).toFixed(1) : 0}%\n`
  );

  // Sample slugs
  const samples = await db.factCheck.findMany({
    where: { slug: { not: null } },
    take: 5,
    orderBy: { publishedAt: "desc" },
    select: { slug: true, title: true },
  });

  if (samples.length > 0) {
    console.log("Sample FactCheck slugs:");
    for (const s of samples) {
      console.log(`  /factchecks/${s.slug}`);
      console.log(`    "${s.title.slice(0, 60)}..."\n`);
    }
  }
}

/**
 * Print help
 */
function printHelp(): void {
  console.log(`
FactCheck Slug Migration Script
================================

Generate SEO-friendly slugs for existing FactChecks.

Usage:
  npx tsx scripts/migrate-factcheck-slugs.ts [options]

Options:
  --dry-run     Preview changes without writing to database
  --stats       Show current migration statistics
  --help        Show this help message

Slug Format:
  YYYY-MM-DD-titre-slugifie (max 80 characters)

Examples:
  /factchecks/2025-03-15-non-la-france-na-pas-interdit

Notes:
  - Duplicate slugs are handled with suffix (-2, -3, etc.)
  - Only records without slugs are processed
  - Run --dry-run first to preview changes
`);
}

/**
 * Main
 */
async function main(): Promise<void> {
  console.log("🔗 FactCheck Slug Migration for SEO-Friendly URLs\n");

  if (showHelp) {
    printHelp();
    return;
  }

  if (showStats) {
    await showStatistics();
    return;
  }

  if (dryRun) {
    console.log("🔍 DRY RUN MODE - No changes will be made\n");
  }

  const result = await migrateFactChecks();

  console.log("═══════════════════════════════════════");
  console.log(`✅ Migration complete!`);
  console.log(`   Updated: ${result.updated}`);
  console.log(`   Skipped: ${result.skipped}`);

  if (dryRun) {
    console.log("\n💡 Run without --dry-run to apply changes");
  } else {
    console.log("\n💡 Run with --stats to verify migration");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
