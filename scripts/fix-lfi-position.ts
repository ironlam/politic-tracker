/**
 * One-time script to fix LFI political position and set Wikidata source for existing parties.
 *
 * Usage: npx tsx scripts/fix-lfi-position.ts
 */
import "dotenv/config";
import { db } from "../src/lib/db";

async function main() {
  // Fix LFI: LEFT per Conseil d'État decision n°488378 (11/03/2024)
  const lfi = await db.party.findFirst({
    where: {
      OR: [{ shortName: "LFI" }, { name: { contains: "France Insoumise", mode: "insensitive" } }],
    },
  });

  if (lfi) {
    await db.party.update({
      where: { id: lfi.id },
      data: {
        politicalPosition: "LEFT",
        politicalPositionSource: "Conseil d'État, décision n°488378 du 11/03/2024",
        politicalPositionSourceUrl: "https://www.legifrance.gouv.fr/ceta/id/CETATEXT000049267171",
        politicalPositionOverride: true,
      },
    });
    console.log(`✓ LFI: ${lfi.politicalPosition} → LEFT (source: Conseil d'État)`);
  } else {
    console.log("⚠ LFI not found in database");
  }

  // Set source to "wikidata" for all parties that have a position but no source yet
  const result = await db.party.updateMany({
    where: {
      politicalPosition: { not: null },
      politicalPositionSource: null,
    },
    data: {
      politicalPositionSource: "wikidata",
    },
  });

  console.log(`✓ Set source to "wikidata" for ${result.count} parties`);
  console.log("\nDone.");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
