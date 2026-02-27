/**
 * Fix senator mandate startDates.
 *
 * Problem: All senator mandates have startDate = import timestamp (Feb 22, 2026)
 * instead of actual mandate start date.
 *
 * Fix: Use the senat.fr API "serie" field to derive the correct start date:
 *   - Serie 1 → elected Sept 24, 2023 → mandate starts Oct 1, 2023
 *   - Serie 2 → elected Sept 27, 2020 → mandate starts Oct 1, 2020
 *
 * Usage: npx dotenv -e .env -- npx tsx scripts/fix-senat-mandate-dates.ts [--dry-run]
 */

import { db } from "@/lib/db";

const SENAT_API_URL = "https://www.senat.fr/api-senat/senateurs.json";

interface SenateurAPI {
  matricule: string;
  nom: string;
  prenom: string;
  serie: number;
}

const SERIE_START_DATES: Record<number, Date> = {
  1: new Date("2023-10-01"),
  2: new Date("2020-10-01"),
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) console.log("[DRY RUN]\n");

  // 1. Fetch current senator series from API
  console.log("Fetching senators from senat.fr API...");
  const res = await fetch(SENAT_API_URL);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const senators: SenateurAPI[] = await res.json();
  console.log(`  → ${senators.length} senators from API`);

  // Build matricule → serie map
  const serieMap = new Map<string, number>();
  for (const s of senators) {
    serieMap.set(s.matricule, s.serie);
  }

  // 2. Find all current senator mandates with bogus startDates (after 2026-01-01)
  const badMandates = await db.mandate.findMany({
    where: {
      type: "SENATEUR",
      isCurrent: true,
      startDate: { gte: new Date("2026-01-01") },
    },
    include: {
      politician: {
        include: {
          externalIds: {
            where: { source: "SENAT" },
            select: { externalId: true },
          },
        },
      },
    },
  });

  console.log(`\nFound ${badMandates.length} senator mandates with bogus startDate`);

  let fixed = 0;
  let notFound = 0;

  for (const mandate of badMandates) {
    const matricule = mandate.politician.externalIds[0]?.externalId;
    const serie = matricule ? serieMap.get(matricule) : undefined;
    const newDate = serie ? SERIE_START_DATES[serie] : undefined;

    if (!newDate) {
      console.log(
        `  ⚠ No serie found for ${mandate.politician.firstName} ${mandate.politician.lastName} (matricule: ${matricule || "?"})`
      );
      notFound++;
      continue;
    }

    if (!dryRun) {
      await db.mandate.update({
        where: { id: mandate.id },
        data: { startDate: newDate },
      });
    }

    console.log(
      `  ✓ ${mandate.politician.firstName} ${mandate.politician.lastName}: serie ${serie} → ${newDate.toISOString().slice(0, 10)}`
    );
    fixed++;
  }

  console.log(`\nDone: ${fixed} fixed, ${notFound} not found`);
  if (dryRun) console.log("(dry run — no changes applied)");

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
