/**
 * CLI script to sync government members from data.gouv.fr
 *
 * Usage:
 *   npx tsx scripts/sync-gouvernement.ts          # Sync current government only
 *   npx tsx scripts/sync-gouvernement.ts --all    # Sync all historical governments
 *   npx tsx scripts/sync-gouvernement.ts --stats  # Show current stats
 *   npx tsx scripts/sync-gouvernement.ts --help   # Show help
 */

import "dotenv/config";
import { syncGovernment, getGovernmentStats, getSyncStats } from "../src/services/sync";

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Politic Tracker - Government Sync CLI

Usage:
  npx tsx scripts/sync-gouvernement.ts          Sync current government members only
  npx tsx scripts/sync-gouvernement.ts --all    Sync all historical governments (Ve République)
  npx tsx scripts/sync-gouvernement.ts --stats  Show current database stats
  npx tsx scripts/sync-gouvernement.ts --help   Show this help message

Data source: data.gouv.fr - Historique des Gouvernements de la Ve République
    `);
    process.exit(0);
  }

  if (args.includes("--stats")) {
    console.log("Fetching current stats...\n");
    const [govStats, globalStats] = await Promise.all([
      getGovernmentStats(),
      getSyncStats(),
    ]);
    console.log("Current database stats:");
    console.log(`  Total politicians: ${globalStats.politicians}`);
    console.log(`  Total parties: ${globalStats.parties}`);
    console.log(`  Current mandates: ${globalStats.currentMandates}`);
    console.log("");
    console.log("Government stats:");
    console.log(`  Current government members: ${govStats.currentGovernmentMembers}`);
    console.log(`  Total government mandates: ${govStats.totalGovernmentMandates}`);
    process.exit(0);
  }

  const syncAll = args.includes("--all");

  // Default: sync current government only
  console.log("=".repeat(50));
  console.log("Politic Tracker - Government Sync");
  console.log("=".repeat(50));
  console.log(`Mode: ${syncAll ? "All historical governments" : "Current government only"}`);
  console.log(`Started at: ${new Date().toISOString()}\n`);

  const startTime = Date.now();
  const result = await syncGovernment({ currentOnly: !syncAll });
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("\n" + "=".repeat(50));
  console.log("Sync Results:");
  console.log("=".repeat(50));
  console.log(`Status: ${result.success ? "SUCCESS" : "FAILED"}`);
  console.log(`Duration: ${duration}s`);
  console.log(`\nGovernment Members:`);
  console.log(`  Created: ${result.membersCreated}`);
  console.log(`  Updated: ${result.membersUpdated}`);
  console.log(`  Mandates created: ${result.mandatesCreated}`);

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
