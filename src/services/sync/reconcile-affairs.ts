/**
 * Affair reconciliation service.
 *
 * Detects potential duplicate affairs from different sources
 * and auto-merges high-confidence duplicates.
 */

import { findPotentialDuplicates, mergeAffairs } from "@/services/affairs/reconciliation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReconcileAffairsOptions {
  dryRun?: boolean;
  autoMerge?: boolean;
}

export interface ReconcileAffairsStats {
  duplicatesFound: number;
  merged: number;
  errors: number;
  remainingPossible: number;
}

// ---------------------------------------------------------------------------
// Main service
// ---------------------------------------------------------------------------

export async function reconcileAffairs(
  options: ReconcileAffairsOptions = {}
): Promise<ReconcileAffairsStats> {
  const { dryRun = false, autoMerge = false } = options;

  const duplicates = await findPotentialDuplicates();

  if (duplicates.length === 0) {
    return { duplicatesFound: 0, merged: 0, errors: 0, remainingPossible: 0 };
  }

  let merged = 0;
  let errors = 0;

  if (autoMerge) {
    const mergeable = duplicates.filter(
      (d) => d.confidence === "CERTAIN" || d.confidence === "HIGH"
    );

    for (const dup of mergeable) {
      const keepId =
        dup.affairA.sources.length >= dup.affairB.sources.length ? dup.affairA.id : dup.affairB.id;
      const removeId = keepId === dup.affairA.id ? dup.affairB.id : dup.affairA.id;

      if (dryRun) {
        merged++;
        continue;
      }

      try {
        await mergeAffairs(keepId, removeId);
        merged++;
      } catch {
        errors++;
      }
    }
  }

  const remainingPossible = duplicates.filter((d) => d.confidence === "POSSIBLE").length;

  return {
    duplicatesFound: duplicates.length,
    merged,
    errors,
    remainingPossible,
  };
}
