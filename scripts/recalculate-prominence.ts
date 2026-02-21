/**
 * Recalculate prominence scores for all politicians.
 *
 * Score range: 0–1000
 * Components:
 *   mandateWeight  (0–400)  — highest mandate/party-role weight, current vs past
 *   activityScore  (0–200)  — votes, press mentions, fact-check mentions
 *   mediaScore     (0–150)  — recent press coverage (last 3 months)
 *   affairsScore   (0–100)  — judicial affairs count
 *   recencyBonus   (0–150)  — bonus for currently active politicians
 *
 * Usage:
 *   set -a && source .env && set +a && npx tsx scripts/recalculate-prominence.ts
 *   npx tsx scripts/recalculate-prominence.ts --dry-run --verbose
 */

import "dotenv/config";
import { recalculateProminence } from "../src/services/sync/prominence";
import { db } from "../src/lib/db";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  console.log("=== Recalculate Prominence Scores ===");
  if (dryRun) console.log("[DRY RUN] No database changes will be made.\n");

  const stats = await recalculateProminence({ dryRun });

  console.log("\n=== Summary ===");
  console.log(`Total politicians:    ${stats.totalPoliticians}`);
  console.log(`Updated:              ${stats.updated}`);
  console.log(`Max score:            ${stats.maxScore}`);
  console.log(`Average score:        ${stats.averageScore}`);

  if (dryRun) {
    console.log(`\n[DRY RUN] Would update ${stats.totalPoliticians} politicians.`);
  }
}

main()
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
