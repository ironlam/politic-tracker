/**
 * One-time migration script to backfill partyId on PRESIDENT_PARTI mandates
 *
 * For each Mandate with type PRESIDENT_PARTI and partyId null,
 * finds the matching Party by name (institution field) and links them.
 *
 * Usage:
 *   npx tsx scripts/migrate-mandate-party-links.ts
 *   npx tsx scripts/migrate-mandate-party-links.ts --dry-run
 */

import "dotenv/config";
import { db } from "../src/lib/db";

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  if (dryRun) {
    console.log("[DRY-RUN] No changes will be made.\n");
  }

  const mandates = await db.mandate.findMany({
    where: {
      type: "PRESIDENT_PARTI",
      partyId: null,
    },
    select: {
      id: true,
      institution: true,
      politician: { select: { fullName: true } },
    },
  });

  console.log(`Found ${mandates.length} PRESIDENT_PARTI mandates without partyId\n`);

  if (mandates.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  // Fetch all parties for matching
  const parties = await db.party.findMany({
    select: { id: true, name: true },
  });
  const partyByName = new Map(parties.map((p) => [p.name, p.id]));

  let updated = 0;
  let notFound = 0;

  for (const mandate of mandates) {
    const partyId = partyByName.get(mandate.institution);

    if (!partyId) {
      console.log(
        `  [SKIP] "${mandate.institution}" — no matching party (${mandate.politician.fullName})`
      );
      notFound++;
      continue;
    }

    if (dryRun) {
      console.log(
        `  [DRY-RUN] Would link mandate to party "${mandate.institution}" (${mandate.politician.fullName})`
      );
    } else {
      await db.mandate.update({
        where: { id: mandate.id },
        data: { partyId },
      });
    }
    updated++;
  }

  console.log(`\nDone: ${updated} updated, ${notFound} parties not found.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
