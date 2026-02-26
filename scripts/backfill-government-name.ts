/**
 * Backfill governmentName on existing government mandates.
 * The institution field already contains "Gouvernement {name}" — extract the name.
 */
import { db } from "../src/lib/db";

async function main() {
  const govMandates = await db.mandate.findMany({
    where: {
      type: {
        in: ["MINISTRE", "PREMIER_MINISTRE", "MINISTRE_DELEGUE", "SECRETAIRE_ETAT"],
      },
      governmentName: null,
    },
    select: { id: true, institution: true },
  });

  console.log(`Found ${govMandates.length} government mandates to backfill`);

  let updated = 0;
  for (const mandate of govMandates) {
    const match = mandate.institution.match(/^Gouvernement\s+(.+)$/i);
    if (match) {
      await db.mandate.update({
        where: { id: mandate.id },
        data: { governmentName: `Gouvernement ${match[1]}` },
      });
      updated++;
    }
  }

  console.log(`Updated ${updated} mandates`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
