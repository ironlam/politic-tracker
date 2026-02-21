/**
 * Affair Reconciliation CLI
 *
 * Detects potential duplicate affairs created by different sources
 * and optionally auto-merges high-confidence duplicates.
 *
 * Usage:
 *   npm run reconcile:affairs                    # List potential duplicates
 *   npm run reconcile:affairs -- --auto-merge    # Auto-merge CERTAIN/HIGH pairs
 *   npm run reconcile:affairs -- --stats         # Show reconciliation stats
 *   npm run reconcile:affairs -- --dry-run       # Preview auto-merge without saving
 */

import "dotenv/config";
import { db } from "../src/lib/db";
import {
  findPotentialDuplicates,
  getReconciliationStats,
  type PotentialDuplicate,
} from "../src/services/affairs/reconciliation";
import { reconcileAffairs } from "../src/services/sync/reconcile-affairs";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const AUTO_MERGE = args.includes("--auto-merge");
const SHOW_STATS = args.includes("--stats");

async function showStats() {
  const stats = await getReconciliationStats();

  console.log("\n" + "=".repeat(50));
  console.log("Reconciliation Stats");
  console.log("=".repeat(50));
  console.log(`Affaires non vérifiées: ${stats.totalUnverified}`);
  console.log(`Doublons potentiels:    ${stats.totalDuplicates}`);
  console.log(`  CERTAIN:  ${stats.duplicatesByCertainty.CERTAIN}`);
  console.log(`  HIGH:     ${stats.duplicatesByCertainty.HIGH}`);
  console.log(`  POSSIBLE: ${stats.duplicatesByCertainty.POSSIBLE}`);
  console.log(`Paires dismissées:      ${stats.totalDismissed}`);
  console.log("");
}

function displayDuplicate(dup: PotentialDuplicate, index: number) {
  console.log(
    `\n${index + 1}. [${dup.confidence}] Score: ${(dup.score * 100).toFixed(0)}% — Match: ${dup.matchedBy}`
  );
  console.log(`   A: ${dup.affairA.title}`);
  console.log(`      Sources: ${dup.affairA.sources.join(", ")} (${dup.affairA.id})`);
  console.log(`   B: ${dup.affairB.title}`);
  console.log(`      Sources: ${dup.affairB.sources.join(", ")} (${dup.affairB.id})`);
}

async function main() {
  const startTime = Date.now();

  console.log("=".repeat(50));
  console.log("Reconciliation des affaires");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : AUTO_MERGE ? "AUTO-MERGE" : "PREVIEW"}`);
  console.log("=".repeat(50));

  if (SHOW_STATS) {
    await showStats();
    await db.$disconnect();
    return;
  }

  // Show full duplicate details for CLI output
  const duplicates = await findPotentialDuplicates();
  if (duplicates.length > 0) {
    console.log(`\n${duplicates.length} doublon(s) potentiel(s) trouvé(s):`);
    for (let i = 0; i < duplicates.length; i++) {
      displayDuplicate(duplicates[i], i);
    }
  }

  // Run the actual merge via the service
  if (AUTO_MERGE) {
    const stats = await reconcileAffairs({ dryRun: DRY_RUN, autoMerge: true });
    console.log(`\nRésultat: ${stats.merged} fusionné(s), ${stats.errors} erreur(s)`);
    if (stats.remainingPossible > 0) {
      console.log(
        `${stats.remainingPossible} doublon(s) POSSIBLE restant(s) (vérification manuelle requise)`
      );
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nTerminé en ${duration}s`);

  await db.$disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
