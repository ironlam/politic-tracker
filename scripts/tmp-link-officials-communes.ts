/**
 * Backfill script: link LocalOfficial.communeId to existing Commune records.
 *
 * Run this AFTER communes are populated (e.g., after sync:candidatures).
 * Uses a single SQL UPDATE — runs in < 1 second instead of 27 min re-sync.
 *
 * Usage: npx dotenv -e .env -- npx tsx scripts/tmp-link-officials-communes.ts
 */
import { db } from "../src/lib/db";

async function main() {
  const communes = await db.commune.count();
  console.log(`Communes in DB: ${communes}`);

  if (communes === 0) {
    console.log("No communes in DB — run sync:candidatures first.");
    return;
  }

  const unlinked = await db.localOfficial.count({
    where: { communeId: null, externalId: { not: null } },
  });
  console.log(`Officials without communeId: ${unlinked}`);

  if (unlinked === 0) {
    console.log("All officials already linked — nothing to do.");
    return;
  }

  // Single SQL UPDATE using JOIN — links all matching officials at once
  const result = await db.$executeRaw`
    UPDATE "LocalOfficial" lo
    SET "communeId" = lo."externalId"
    FROM "Commune" c
    WHERE lo."externalId" = c.id
      AND lo."communeId" IS NULL
  `;

  console.log(`Linked ${result} officials to their commune in one query.`);

  // Report remaining unlinked (communes not in our DB)
  const stillUnlinked = await db.localOfficial.count({
    where: { communeId: null, externalId: { not: null } },
  });
  console.log(`Still unlinked: ${stillUnlinked} (communes not in DB)`);
}

main();
