/**
 * CLI script to sync senators from senat.fr
 *
 * Usage:
 *   npx tsx scripts/sync-senat.ts          # Full sync
 *   npx tsx scripts/sync-senat.ts --stats  # Show current stats
 *   npx tsx scripts/sync-senat.ts --help   # Show help
 */

import "dotenv/config";
import { syncSenators, getSenatStats, getSyncStats } from "../src/services/sync";

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Politic Tracker - Senators Sync CLI

Usage:
  npx tsx scripts/sync-senat.ts          Full sync (import/update all senators)
  npx tsx scripts/sync-senat.ts --stats  Show current database stats
  npx tsx scripts/sync-senat.ts --help   Show this help message

Data sources:
  - Primary: senat.fr API (official Senate data)
  - Secondary: archive.nossenateurs.fr (birth dates, historical data)
    `);
    process.exit(0);
  }

  if (args.includes("--stats")) {
    console.log("Fetching current stats...\n");
    const [senatStats, globalStats] = await Promise.all([
      getSenatStats(),
      getSyncStats(),
    ]);
    console.log("Current database stats:");
    console.log(`  Total politicians: ${globalStats.politicians}`);
    console.log(`  Total parties: ${globalStats.parties}`);
    console.log(`  Current mandates: ${globalStats.currentMandates}`);
    console.log("");
    console.log("Senate stats:");
    console.log(`  Senators with current mandate: ${senatStats.senators}`);
    console.log(`  Current senator mandates: ${senatStats.currentMandates}`);
    process.exit(0);
  }

  // Default: full sync
  console.log("=".repeat(50));
  console.log("Politic Tracker - Senators Sync");
  console.log("=".repeat(50));
  console.log(`Started at: ${new Date().toISOString()}\n`);

  const startTime = Date.now();
  const result = await syncSenators();
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("\n" + "=".repeat(50));
  console.log("Sync Results:");
  console.log("=".repeat(50));
  console.log(`Status: ${result.success ? "SUCCESS" : "FAILED"}`);
  console.log(`Duration: ${duration}s`);
  console.log(`\nParties/Groups:`);
  console.log(`  Created: ${result.partiesCreated}`);
  console.log(`  Updated: ${result.partiesUpdated}`);
  console.log(`\nSenators:`);
  console.log(`  Created: ${result.senatorsCreated}`);
  console.log(`  Updated: ${result.senatorsUpdated}`);

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
