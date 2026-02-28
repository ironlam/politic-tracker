import { db } from "../src/lib/db";
import { parse } from "csv-parse/sync";

/**
 * One-shot migration: fix MAIRE mandates that display raw INSEE codes
 * instead of commune names (e.g. "Maire (64445)" → "Maire de Pau").
 *
 * Downloads the RNE CSV to build a complete commune name lookup (35k entries),
 * then resolves each mandate's INSEE code to its commune name.
 *
 * Run: npx dotenv -e .env -- npx tsx scripts/tmp-fix-maire-mandates.ts
 */

const RNE_MAIRES_CSV_URL =
  "https://static.data.gouv.fr/resources/repertoire-national-des-elus-1/20251223-104211/elus-maires-mai.csv";

async function main() {
  // Step 1: Download RNE CSV and build commune name map
  console.log("Fetching RNE CSV for commune name lookup...");
  const response = await fetch(RNE_MAIRES_CSV_URL);
  if (!response.ok) throw new Error(`Failed to fetch CSV: ${response.status}`);
  const csvText = await response.text();
  const records = parse(csvText, {
    delimiter: ";",
    columns: true,
    skip_empty_lines: true,
    bom: true,
  }) as Array<Record<string, string>>;

  // Build Map<inseeCode, communeName> from CSV
  const communeNameByInsee = new Map<string, string>();
  for (const row of records) {
    const code = row["Code de la commune"]?.trim();
    const name = row["Libellé de la commune"]?.trim();
    if (code && name) communeNameByInsee.set(code, name);
  }
  console.log(`Built lookup with ${communeNameByInsee.size} commune names from CSV`);

  // Step 2: Find MAIRE mandates with raw codes in title
  const maireMandates = await db.mandate.findMany({
    where: {
      type: "MAIRE",
      title: { startsWith: "Maire (" },
    },
    select: {
      id: true,
      title: true,
      constituency: true,
      politicianId: true,
    },
  });

  console.log(`Found ${maireMandates.length} MAIRE mandates with raw titles`);

  if (maireMandates.length === 0) {
    console.log("Nothing to fix!");
    await db.$disconnect();
    return;
  }

  // Step 3: Pre-load LocalOfficials to resolve dept-only mandates
  const officials = await db.localOfficial.findMany({
    where: { role: "MAIRE", politicianId: { not: null } },
    select: { politicianId: true, externalId: true },
  });
  const officialByPoliticianId = new Map(officials.map((o) => [o.politicianId!, o]));
  console.log(`Loaded ${officials.length} LocalOfficials for fallback resolution`);

  let fixed = 0;
  let skipped = 0;

  for (const mandate of maireMandates) {
    // Try to extract INSEE code from title "Maire (XXXXX)"
    let inseeCode: string | undefined;
    const match5 = mandate.title.match(/^Maire \((\d{5})\)$/);
    if (match5) {
      inseeCode = match5[1];
    }

    // For 2-digit dept codes like "Maire (64)", resolve via LocalOfficial
    if (!inseeCode && mandate.politicianId) {
      const official = officialByPoliticianId.get(mandate.politicianId);
      if (official?.externalId) {
        inseeCode = official.externalId;
      }
    }

    // Also try constituency field
    if (!inseeCode) {
      const fromConstituency = mandate.constituency?.match(/^\d{5}$/)?.[0];
      if (fromConstituency) inseeCode = fromConstituency;
    }

    if (!inseeCode) {
      console.log(`  SKIP: ${mandate.title} — cannot resolve INSEE code`);
      skipped++;
      continue;
    }

    const communeName = communeNameByInsee.get(inseeCode);
    if (!communeName) {
      console.log(`  SKIP: ${mandate.title} — commune ${inseeCode} not in RNE CSV`);
      skipped++;
      continue;
    }

    await db.mandate.update({
      where: { id: mandate.id },
      data: {
        title: `Maire de ${communeName}`,
        constituency: `${communeName} (${inseeCode})`,
      },
    });
    fixed++;
    console.log(`  FIXED: ${mandate.title} → Maire de ${communeName}`);
  }

  console.log(`\nDone: ${fixed} fixed, ${skipped} skipped`);
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
