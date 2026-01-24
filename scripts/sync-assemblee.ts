/**
 * CLI script to sync deputies from data.gouv.fr
 *
 * Usage:
 *   npx tsx scripts/sync-deputies.ts          # Full sync
 *   npx tsx scripts/sync-deputies.ts --stats  # Show current stats
 *   npx tsx scripts/sync-deputies.ts --help   # Show help
 */

import "dotenv/config";
import { syncDeputies, getSyncStats } from "../src/services/sync";

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Politic Tracker - Deputies Sync CLI

Usage:
  npx tsx scripts/sync-deputies.ts          Full sync (import/update all deputies)
  npx tsx scripts/sync-deputies.ts --stats  Show current database stats
  npx tsx scripts/sync-deputies.ts --help   Show this help message

Data source: data.gouv.fr (Datan dataset, updated daily)
    `);
    process.exit(0);
  }

  if (args.includes("--stats")) {
    console.log("Fetching current stats...\n");
    const stats = await getSyncStats();
    console.log("Current database stats:");
    console.log(`  Politicians: ${stats.politicians}`);
    console.log(`  Parties: ${stats.parties}`);
    console.log(`  Current mandates: ${stats.currentMandates}`);
    process.exit(0);
  }

  // Default: full sync
  console.log("=".repeat(50));
  console.log("Politic Tracker - Deputies Sync");
  console.log("=".repeat(50));
  console.log(`Started at: ${new Date().toISOString()}\n`);

  const startTime = Date.now();
  const result = await syncDeputies();
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("\n" + "=".repeat(50));
  console.log("Sync Results:");
  console.log("=".repeat(50));
  console.log(`Status: ${result.success ? "SUCCESS" : "FAILED"}`);
  console.log(`Duration: ${duration}s`);
  console.log(`\nParties:`);
  console.log(`  Created: ${result.partiesCreated}`);
  console.log(`  Updated: ${result.partiesUpdated}`);
  console.log(`\nDeputies:`);
  console.log(`  Created: ${result.deputiesCreated}`);
  console.log(`  Updated: ${result.deputiesUpdated}`);

  if (result.errors.length > 0) {
    console.log(`\nErrors (${result.errors.length}):`);
    result.errors.slice(0, 10).forEach((e) => console.log(`  - ${e}`));
    if (result.errors.length > 10) {
      console.log(`  ... and ${result.errors.length - 10} more`);
    }
  }

  console.log("\n" + "=".repeat(50));
  process.exit(result.success ? 0 : 1);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
