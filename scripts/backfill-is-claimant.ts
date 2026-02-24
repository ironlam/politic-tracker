/**
 * Backfill script: compute isClaimant for existing FactCheckMentions.
 *
 * For each FactCheck, checks whether the claimant matches any of the
 * mentioned politicians (using the same name-matching logic as the sync).
 *
 * Usage:
 *   npx dotenv -e .env -- npx tsx scripts/backfill-is-claimant.ts             # Run backfill
 *   npx dotenv -e .env -- npx tsx scripts/backfill-is-claimant.ts --dry-run   # Preview only
 */

import "dotenv/config";
import { db } from "../src/lib/db";
import { buildPoliticianIndex, findMentions } from "../src/lib/name-matching";
import { isDirectPoliticianClaim } from "../src/config/labels";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  console.log(`Backfill isClaimant${dryRun ? " (DRY RUN)" : ""}\n`);

  const allPoliticians = await buildPoliticianIndex();
  console.log(`Loaded ${allPoliticians.length} politicians for matching\n`);

  // Load all fact-checks with their mentions in batches
  const BATCH_SIZE = 500;
  let offset = 0;
  let totalUpdated = 0;
  let totalProcessed = 0;

  while (true) {
    const factChecks = await db.factCheck.findMany({
      select: {
        id: true,
        claimant: true,
        mentions: {
          select: { id: true, politicianId: true },
        },
      },
      orderBy: { id: "asc" },
      skip: offset,
      take: BATCH_SIZE,
    });

    if (factChecks.length === 0) break;

    for (const fc of factChecks) {
      totalProcessed++;

      if (!fc.claimant || !isDirectPoliticianClaim(fc.claimant)) continue;

      // Find which politicians match the claimant string (fullNameOnly to avoid false positives)
      const claimantMatches = findMentions(fc.claimant, allPoliticians, { fullNameOnly: true });
      const claimantIds = new Set(claimantMatches.map((m) => m.politicianId));

      if (claimantIds.size === 0) continue;

      // Find mentions that should be marked as claimant
      const mentionsToUpdate = fc.mentions.filter((m) => claimantIds.has(m.politicianId));

      for (const mention of mentionsToUpdate) {
        if (dryRun) {
          const pol = allPoliticians.find((p) => p.id === mention.politicianId);
          console.log(`  [DRY RUN] ${pol?.fullName || mention.politicianId} ← "${fc.claimant}"`);
        } else {
          await db.factCheckMention.update({
            where: { id: mention.id },
            data: { isClaimant: true },
          });
        }
        totalUpdated++;
      }
    }

    offset += BATCH_SIZE;
    process.stdout.write(`\r  Processed ${totalProcessed} fact-checks...`);
  }

  console.log(
    `\n\nDone: ${totalUpdated} mentions marked as isClaimant=true (out of ${totalProcessed} fact-checks)`
  );

  await db.$disconnect();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  db.$disconnect();
  process.exit(1);
});
