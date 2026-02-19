/**
 * One-shot migration: reject existing DRAFT affairs with low confidence scores.
 *
 * Usage:
 *   npx tsx scripts/reject-low-confidence-affairs.ts              # dry-run (default)
 *   npx tsx scripts/reject-low-confidence-affairs.ts --apply       # apply changes
 */

import { db } from "@/lib/db";
import { MIN_CONFIDENCE_THRESHOLD } from "@/config/press-analysis";

async function main() {
  const apply = process.argv.includes("--apply");

  console.log("=".repeat(50));
  console.log("Reject low-confidence DRAFT affairs");
  console.log("=".repeat(50));
  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}`);
  console.log(`Threshold: confidenceScore < ${MIN_CONFIDENCE_THRESHOLD}\n`);

  const affairs = await db.affair.findMany({
    where: {
      publicationStatus: "DRAFT",
      confidenceScore: { lt: MIN_CONFIDENCE_THRESHOLD },
    },
    select: {
      id: true,
      title: true,
      confidenceScore: true,
      politician: { select: { fullName: true } },
    },
  });

  if (affairs.length === 0) {
    console.log("Aucune affaire DRAFT avec score < seuil trouvée.");
    await db.$disconnect();
    return;
  }

  console.log(`${affairs.length} affaire(s) à rejeter:\n`);

  for (const affair of affairs) {
    console.log(
      `  [score=${affair.confidenceScore}] ${affair.title} — ${affair.politician.fullName}`
    );

    if (apply) {
      await db.affair.update({
        where: { id: affair.id },
        data: {
          publicationStatus: "REJECTED",
          rejectionReason: `Auto-rejected: confidence score ${affair.confidenceScore} below threshold ${MIN_CONFIDENCE_THRESHOLD}`,
        },
      });
    }
  }

  console.log(
    `\n${apply ? "✓" : "[DRY-RUN]"} ${affairs.length} affaire(s) ${apply ? "rejetées" : "seraient rejetées"}`
  );

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
