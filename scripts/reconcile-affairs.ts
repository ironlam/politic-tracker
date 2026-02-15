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
  mergeAffairs,
  getReconciliationStats,
  type PotentialDuplicate,
} from "../src/services/affairs/reconciliation";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const AUTO_MERGE = args.includes("--auto-merge");
const SHOW_STATS = args.includes("--stats");
const VERBOSE = args.includes("--verbose");

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

  // Find duplicates
  console.log("\nRecherche de doublons potentiels...");
  const duplicates = await findPotentialDuplicates();

  if (duplicates.length === 0) {
    console.log("\nAucun doublon potentiel détecté.");
    await db.$disconnect();
    return;
  }

  console.log(`\n${duplicates.length} doublon(s) potentiel(s) trouvé(s):`);

  // Display all duplicates
  for (let i = 0; i < duplicates.length; i++) {
    displayDuplicate(duplicates[i], i);
  }

  // Auto-merge CERTAIN and HIGH confidence pairs
  if (AUTO_MERGE) {
    const mergeable = duplicates.filter(
      (d) => d.confidence === "CERTAIN" || d.confidence === "HIGH"
    );

    if (mergeable.length === 0) {
      console.log("\nAucun doublon avec confiance CERTAIN ou HIGH à fusionner.");
    } else {
      console.log(`\n${"─".repeat(50)}`);
      console.log(
        `${DRY_RUN ? "[DRY-RUN] " : ""}Fusion automatique de ${mergeable.length} paire(s)...`
      );

      let merged = 0;
      let errors = 0;

      for (const dup of mergeable) {
        // Keep the affair with more sources, or the older one
        const keepId =
          dup.affairA.sources.length >= dup.affairB.sources.length
            ? dup.affairA.id
            : dup.affairB.id;
        const removeId = keepId === dup.affairA.id ? dup.affairB.id : dup.affairA.id;

        if (DRY_RUN) {
          console.log(`  [DRY-RUN] Fusionnerait ${removeId} → ${keepId}`);
          merged++;
          continue;
        }

        try {
          await mergeAffairs(keepId, removeId);
          console.log(`  Fusionné: ${removeId} → ${keepId}`);
          merged++;
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.error(`  Erreur fusion ${removeId} → ${keepId}: ${msg}`);
          errors++;
        }
      }

      console.log(`\nRésultat: ${merged} fusionné(s), ${errors} erreur(s)`);
    }

    // Show remaining POSSIBLE duplicates
    const remaining = duplicates.filter((d) => d.confidence === "POSSIBLE");
    if (remaining.length > 0) {
      console.log(
        `\n${remaining.length} doublon(s) POSSIBLE restant(s) (vérification manuelle requise)`
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
