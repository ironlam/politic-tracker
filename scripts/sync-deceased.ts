/**
 * CLI script to sync death dates from Wikidata
 *
 * Usage:
 *   npx tsx scripts/sync-deceased.ts          # Sync death dates
 *   npx tsx scripts/sync-deceased.ts --stats  # Show current stats
 *   npx tsx scripts/sync-deceased.ts --help   # Show help
 */

import "dotenv/config";
import { syncDeceasedFromWikidata, updateDeceasedMandates, getDeceasedStats } from "../src/services/sync/deceased";
import { getSyncStats } from "../src/services/sync";

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Politic Tracker - Deceased Sync CLI

Usage:
  npx tsx scripts/sync-deceased.ts          Sync death dates from Wikidata
  npx tsx scripts/sync-deceased.ts --stats  Show current deceased statistics
  npx tsx scripts/sync-deceased.ts --help   Show this help message

This script:
  1. Fetches death dates from Wikidata for politicians with Wikidata IDs
  2. Marks mandates as not current for deceased politicians
    `);
    process.exit(0);
  }

  if (args.includes("--stats")) {
    console.log("Fetching current stats...\n");
    const [deceasedStats, globalStats] = await Promise.all([
      getDeceasedStats(),
      getSyncStats(),
    ]);
    console.log("Current database stats:");
    console.log(`  Total politicians: ${globalStats.politicians}`);
    console.log("");
    console.log("Deceased stats:");
    console.log(`  Deceased: ${deceasedStats.deceased}`);
    console.log(`  Alive/Unknown: ${deceasedStats.alive}`);
    console.log(`  Deceased with 'current' mandate: ${deceasedStats.deceasedWithCurrentMandate}`);
    process.exit(0);
  }

  // Default: sync deceased
  console.log("=".repeat(50));
  console.log("Politic Tracker - Deceased Sync");
  console.log("=".repeat(50));
  console.log(`Started at: ${new Date().toISOString()}\n`);

  const startTime = Date.now();

  // Step 1: Sync death dates from Wikidata
  const result = await syncDeceasedFromWikidata();

  // Step 2: Update mandates for deceased politicians
  console.log("\nUpdating mandates for deceased politicians...");
  const mandatesUpdated = await updateDeceasedMandates();

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("\n" + "=".repeat(50));
  console.log("Sync Results:");
  console.log("=".repeat(50));
  console.log(`Status: ${result.success ? "SUCCESS" : "FAILED"}`);
  console.log(`Duration: ${duration}s`);
  console.log(`\nDeath dates:`);
  console.log(`  Checked: ${result.checked}`);
  console.log(`  Updated: ${result.updated}`);
  console.log(`\nMandates marked as not current: ${mandatesUpdated}`);

  if (result.errors.length > 0) {
    console.log(`\nErrors (${result.errors.length}):`);
    result.errors.slice(0, 10).forEach((e) => console.log(`  - ${e}`));
  }

  console.log("\n" + "=".repeat(50));
  process.exit(result.success ? 0 : 1);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
