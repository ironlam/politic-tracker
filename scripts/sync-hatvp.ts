/**
 * CLI script to sync HATVP declarations
 *
 * Usage:
 *   npx tsx scripts/sync-hatvp.ts          # Full sync
 *   npx tsx scripts/sync-hatvp.ts --stats  # Show current stats
 *   npx tsx scripts/sync-hatvp.ts --help   # Show help
 */

import "dotenv/config";
import { syncHATVP, getHATVPStats, getSyncStats } from "../src/services/sync";

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Politic Tracker - HATVP Declarations Sync CLI

Usage:
  npx tsx scripts/sync-hatvp.ts          Full sync (import all declarations)
  npx tsx scripts/sync-hatvp.ts --stats  Show current database stats
  npx tsx scripts/sync-hatvp.ts --help   Show this help message

Data source: HATVP Open Data (hatvp.fr)
Imports: Déclarations de patrimoine et d'intérêts
    `);
    process.exit(0);
  }

  if (args.includes("--stats")) {
    console.log("Fetching current stats...\n");
    const [hatvpStats, globalStats] = await Promise.all([
      getHATVPStats(),
      getSyncStats(),
    ]);
    console.log("Current database stats:");
    console.log(`  Total politicians: ${globalStats.politicians}`);
    console.log(`  Total parties: ${globalStats.parties}`);
    console.log(`  Current mandates: ${globalStats.currentMandates}`);
    console.log("");
    console.log("HATVP stats:");
    console.log(`  Total declarations: ${hatvpStats.totalDeclarations}`);
    console.log(`  Politicians with declarations: ${hatvpStats.politiciansWithDeclarations}`);
    process.exit(0);
  }

  // Default: full sync
  console.log("=".repeat(50));
  console.log("Politic Tracker - HATVP Sync");
  console.log("=".repeat(50));
  console.log(`Started at: ${new Date().toISOString()}\n`);

  const startTime = Date.now();
  const result = await syncHATVP();
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("\n" + "=".repeat(50));
  console.log("Sync Results:");
  console.log("=".repeat(50));
  console.log(`Status: ${result.success ? "SUCCESS" : "FAILED"}`);
  console.log(`Duration: ${duration}s`);
  console.log(`\nDeclarations:`);
  console.log(`  Created: ${result.declarationsCreated}`);
  console.log(`  Updated: ${result.declarationsUpdated}`);
  console.log(`\nPoliticians:`);
  console.log(`  Matched: ${result.politiciansMatched}`);
  console.log(`  Not found: ${result.politiciansNotFound}`);

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
