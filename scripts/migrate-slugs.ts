/**
 * Migration script to generate SEO-friendly slugs for existing Scrutins and LegislativeDossiers
 *
 * Usage:
 *   npx tsx scripts/migrate-slugs.ts              # Run migration
 *   npx tsx scripts/migrate-slugs.ts --dry-run    # Preview without writing
 *   npx tsx scripts/migrate-slugs.ts --scrutins   # Only migrate scrutins
 *   npx tsx scripts/migrate-slugs.ts --dossiers   # Only migrate dossiers
 *   npx tsx scripts/migrate-slugs.ts --stats      # Show current stats
 *   npx tsx scripts/migrate-slugs.ts --help       # Show help
 */

import "dotenv/config";
import { db } from "../src/lib/db";
import { generateDateSlug } from "../src/lib/utils";

// Parse arguments
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const onlyScrutins = args.includes("--scrutins");
const onlyDossiers = args.includes("--dossiers");
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
    // Add suffix: keep it short by truncating base slug if needed
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
 * Migrate scrutins to have slugs
 */
async function migrateScrutins(): Promise<{ updated: number; skipped: number }> {
  console.log("\n📋 Migrating Scrutins...\n");

  const scrutins = await db.scrutin.findMany({
    where: { slug: null },
    orderBy: { votingDate: "desc" },
    select: {
      id: true,
      title: true,
      votingDate: true,
      externalId: true,
    },
  });

  if (scrutins.length === 0) {
    console.log("✓ All scrutins already have slugs\n");
    return { updated: 0, skipped: 0 };
  }

  console.log(`Found ${scrutins.length} scrutins without slugs\n`);

  const existingSlugs = new Set<string>();
  let updated = 0;
  let skipped = 0;

  // Load existing slugs
  const existing = await db.scrutin.findMany({
    where: { slug: { not: null } },
    select: { slug: true },
  });
  for (const s of existing) {
    if (s.slug) existingSlugs.add(s.slug);
  }

  for (let i = 0; i < scrutins.length; i++) {
    const scrutin = scrutins[i];
    updateLine(`${renderProgressBar(i + 1, scrutins.length)} Processing ${scrutin!.externalId}`);

    try {
      const baseSlug = generateDateSlug(scrutin!.votingDate, scrutin!.title);
      const uniqueSlug = await getUniqueSlug(baseSlug, existingSlugs, async (slug) => {
        const exists = await db.scrutin.findUnique({ where: { slug } });
        return exists !== null;
      });

      if (dryRun) {
        console.log(`\n  [DRY RUN] ${scrutin!.externalId} → ${uniqueSlug}`);
      } else {
        await db.scrutin.update({
          where: { id: scrutin!.id },
          data: { slug: uniqueSlug },
        });
      }
      updated++;
    } catch (error) {
      console.error(`\n  Error processing ${scrutin!.externalId}:`, error);
      skipped++;
    }
  }

  console.log(`\n\n✓ Scrutins: ${updated} updated, ${skipped} skipped\n`);
  return { updated, skipped };
}

/**
 * Migrate dossiers to have slugs
 */
async function migrateDossiers(): Promise<{ updated: number; skipped: number }> {
  console.log("\n📁 Migrating Legislative Dossiers...\n");

  const dossiers = await db.legislativeDossier.findMany({
    where: { slug: null },
    orderBy: { filingDate: "desc" },
    select: {
      id: true,
      title: true,
      shortTitle: true,
      filingDate: true,
      externalId: true,
    },
  });

  if (dossiers.length === 0) {
    console.log("✓ All dossiers already have slugs\n");
    return { updated: 0, skipped: 0 };
  }

  console.log(`Found ${dossiers.length} dossiers without slugs\n`);

  const existingSlugs = new Set<string>();
  let updated = 0;
  let skipped = 0;

  // Load existing slugs
  const existing = await db.legislativeDossier.findMany({
    where: { slug: { not: null } },
    select: { slug: true },
  });
  for (const d of existing) {
    if (d.slug) existingSlugs.add(d.slug);
  }

  for (let i = 0; i < dossiers.length; i++) {
    const dossier = dossiers[i];
    updateLine(`${renderProgressBar(i + 1, dossiers.length)} Processing ${dossier!.externalId}`);

    try {
      // Prefer shortTitle for slug, fallback to title
      const titleForSlug = dossier!.shortTitle || dossier!.title;
      const baseSlug = generateDateSlug(dossier!.filingDate, titleForSlug);
      const uniqueSlug = await getUniqueSlug(baseSlug, existingSlugs, async (slug) => {
        const exists = await db.legislativeDossier.findUnique({ where: { slug } });
        return exists !== null;
      });

      if (dryRun) {
        console.log(`\n  [DRY RUN] ${dossier!.externalId} → ${uniqueSlug}`);
      } else {
        await db.legislativeDossier.update({
          where: { id: dossier!.id },
          data: { slug: uniqueSlug },
        });
      }
      updated++;
    } catch (error) {
      console.error(`\n  Error processing ${dossier!.externalId}:`, error);
      skipped++;
    }
  }

  console.log(`\n\n✓ Dossiers: ${updated} updated, ${skipped} skipped\n`);
  return { updated, skipped };
}

/**
 * Show statistics
 */
async function showStatistics(): Promise<void> {
  console.log("\n📊 Slug Migration Statistics\n");

  const [totalScrutins, scrutinsWithSlug, totalDossiers, dossiersWithSlug] = await Promise.all([
    db.scrutin.count(),
    db.scrutin.count({ where: { slug: { not: null } } }),
    db.legislativeDossier.count(),
    db.legislativeDossier.count({ where: { slug: { not: null } } }),
  ]);

  console.log("Scrutins:");
  console.log(`  Total: ${totalScrutins}`);
  console.log(`  With slug: ${scrutinsWithSlug}`);
  console.log(`  Without slug: ${totalScrutins - scrutinsWithSlug}`);
  console.log(`  Coverage: ${((scrutinsWithSlug / totalScrutins) * 100).toFixed(1)}%\n`);

  console.log("Legislative Dossiers:");
  console.log(`  Total: ${totalDossiers}`);
  console.log(`  With slug: ${dossiersWithSlug}`);
  console.log(`  Without slug: ${totalDossiers - dossiersWithSlug}`);
  console.log(`  Coverage: ${((dossiersWithSlug / totalDossiers) * 100).toFixed(1)}%\n`);

  // Sample slugs
  const sampleScrutins = await db.scrutin.findMany({
    where: { slug: { not: null } },
    take: 3,
    orderBy: { votingDate: "desc" },
    select: { slug: true, title: true },
  });

  if (sampleScrutins.length > 0) {
    console.log("Sample Scrutin slugs:");
    for (const s of sampleScrutins) {
      console.log(`  /votes/${s.slug}`);
      console.log(`    "${s.title.slice(0, 60)}..."\n`);
    }
  }

  const sampleDossiers = await db.legislativeDossier.findMany({
    where: { slug: { not: null } },
    take: 3,
    orderBy: { filingDate: "desc" },
    select: { slug: true, shortTitle: true, title: true },
  });

  if (sampleDossiers.length > 0) {
    console.log("Sample Dossier slugs:");
    for (const d of sampleDossiers) {
      console.log(`  /assemblee/${d.slug}`);
      console.log(`    "${(d.shortTitle || d.title).slice(0, 60)}..."\n`);
    }
  }
}

/**
 * Print help
 */
function printHelp(): void {
  console.log(`
Slug Migration Script
=====================

Generate SEO-friendly slugs for Scrutins and LegislativeDossiers.

Usage:
  npx tsx scripts/migrate-slugs.ts [options]

Options:
  --dry-run     Preview changes without writing to database
  --scrutins    Only migrate scrutins
  --dossiers    Only migrate legislative dossiers
  --stats       Show current migration statistics
  --help        Show this help message

Slug Format:
  YYYY-MM-DD-titre-slugifie (max 80 characters)

Examples:
  /votes/2025-01-15-projet-loi-finances-2025
  /assemblee/2024-12-03-reforme-retraites

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
  console.log("🔗 Slug Migration for SEO-Friendly URLs\n");

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

  let totalUpdated = 0;
  let totalSkipped = 0;

  // Migrate scrutins
  if (!onlyDossiers) {
    const result = await migrateScrutins();
    totalUpdated += result.updated;
    totalSkipped += result.skipped;
  }

  // Migrate dossiers
  if (!onlyScrutins) {
    const result = await migrateDossiers();
    totalUpdated += result.updated;
    totalSkipped += result.skipped;
  }

  console.log("═══════════════════════════════════════");
  console.log(`✅ Migration complete!`);
  console.log(`   Updated: ${totalUpdated}`);
  console.log(`   Skipped: ${totalSkipped}`);

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
