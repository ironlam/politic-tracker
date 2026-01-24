/**
 * CLI script to sync MEPs from European Parliament
 *
 * Usage:
 *   npx tsx scripts/sync-europarl.ts          # Full sync
 *   npx tsx scripts/sync-europarl.ts --stats  # Show current stats
 *   npx tsx scripts/sync-europarl.ts --help   # Show help
 */

import "dotenv/config";
import { syncEuroparl, getEuroparlStats } from "../src/services/sync";

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Politic Tracker - European Parliament MEPs Sync CLI

Usage:
  npx tsx scripts/sync-europarl.ts          Full sync (import/update all French MEPs)
  npx tsx scripts/sync-europarl.ts --stats  Show current database stats
  npx tsx scripts/sync-europarl.ts --help   Show this help message

Data source: European Parliament Open Data API (data.europarl.europa.eu)
    `);
    process.exit(0);
  }

  if (args.includes("--stats")) {
    console.log("Fetching current stats...\n");
    const stats = await getEuroparlStats();
    console.log("European Parliament stats:");
    console.log(`  Total MEPs: ${stats.totalMEPs}`);
    console.log(`  Total Groups: ${stats.totalGroups}`);
    console.log("\n  By political group:");
    for (const group of stats.byGroup) {
      console.log(`    ${group.code} (${group.name}): ${group.count}`);
    }
    process.exit(0);
  }

  // Default: full sync
  console.log("=".repeat(50));
  console.log("Politic Tracker - European Parliament Sync");
  console.log("=".repeat(50));
  console.log(`Started at: ${new Date().toISOString()}\n`);

  const startTime = Date.now();
  const result = await syncEuroparl();
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("\n" + "=".repeat(50));
  console.log("Sync Results:");
  console.log("=".repeat(50));
  console.log(`Status: ${result.success ? "SUCCESS" : "PARTIAL"}`);
  console.log(`Duration: ${duration}s`);
  console.log(`\nMEPs:`);
  console.log(`  Created: ${result.mepsCreated}`);
  console.log(`  Updated: ${result.mepsUpdated}`);
  console.log(`\nMandates:`);
  console.log(`  Created: ${result.mandatesCreated}`);
  console.log(`  Updated: ${result.mandatesUpdated}`);

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
