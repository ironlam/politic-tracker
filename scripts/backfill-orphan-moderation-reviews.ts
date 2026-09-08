/**
 * Backfill: close moderation reviews orphaned by the missing appliedAt write.
 *
 * `ModerationReview.appliedAt` gates every moderation queue, and until
 * `closeModerationReviews()` shipped, no code path ever wrote it. Every
 * editorial decision therefore left its review pending forever, and the admin
 * counter grew by one row each time someone did the work.
 *
 * This closes the historical residue: reviews still pending whose affair has
 * already left DRAFT, so there is nothing left to decide. A DRAFT affair keeps
 * its pending review, because that one is real work.
 *
 * Versioned on purpose, not a throwaway under scripts/.local: the July 2026
 * matching triage lost its review capacity when its scratch script was
 * deleted, and the backlog came straight back.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/backfill-orphan-moderation-reviews.ts            # rapport
 *   npx tsx --env-file=.env scripts/backfill-orphan-moderation-reviews.ts --apply
 *   npx tsx --env-file=.env scripts/backfill-orphan-moderation-reviews.ts --revoke
 */
import { db } from "@/lib/db";
import { APPLIED_BY_BACKFILL } from "@/lib/affairs/close-moderation-reviews";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const revoke = args.includes("--revoke");

/** A review is orphaned when its affair has already been decided. */
const DECIDED = ["PUBLISHED", "REJECTED", "ARCHIVED", "EXCLUDED"] as const;

async function main() {
  if (revoke) {
    const { count } = await db.moderationReview.updateMany({
      where: { appliedBy: APPLIED_BY_BACKFILL },
      data: { appliedAt: null, appliedBy: null },
    });
    console.log(`Révoqué : ${count} revue(s) remises en attente.`);
    return;
  }

  const orphans = await db.moderationReview.findMany({
    where: { appliedAt: null, affair: { publicationStatus: { in: [...DECIDED] } } },
    select: {
      id: true,
      recommendation: true,
      createdAt: true,
      affair: { select: { publicationStatus: true } },
    },
  });

  const stillPending = await db.moderationReview.count({
    where: { appliedAt: null, affair: { publicationStatus: "DRAFT" } },
  });

  const byStatus: Record<string, number> = {};
  for (const o of orphans) {
    const k = o.affair.publicationStatus;
    byStatus[k] = (byStatus[k] ?? 0) + 1;
  }

  console.log("=== Revues orphelines (affaire déjà tranchée) ===");
  for (const [status, n] of Object.entries(byStatus).sort()) {
    console.log(`  ${status.padEnd(10)} ${n}`);
  }
  console.log(`  TOTAL à clore : ${orphans.length}`);
  console.log(`  Laissées en attente (affaire DRAFT, vrai travail) : ${stillPending}`);

  if (!apply) {
    console.log("\nMode rapport. Relancer avec --apply pour écrire.");
    return;
  }

  const { count } = await db.moderationReview.updateMany({
    where: { appliedAt: null, affair: { publicationStatus: { in: [...DECIDED] } } },
    data: { appliedAt: new Date(), appliedBy: APPLIED_BY_BACKFILL },
  });

  // Le compteur d'écriture, jamais la taille du lot : c'est lui qui dit la vérité.
  console.log(`\nÉcrit : ${count} revue(s) closes, marquées ${APPLIED_BY_BACKFILL}.`);
  if (count !== orphans.length) {
    console.log(
      `  Écart avec le rapport (${orphans.length}) : des décisions ont eu lieu entre les deux requêtes.`
    );
  }

  const remaining = await db.moderationReview.count({ where: { appliedAt: null } });
  console.log(`  File « Revues de modération » après backfill : ${remaining}`);
}

main()
  .catch((e) => {
    console.error("ERREUR", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
