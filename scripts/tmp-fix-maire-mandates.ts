import { db } from "../src/lib/db";

/**
 * One-shot migration: fix MAIRE mandates that display raw INSEE codes
 * instead of commune names (e.g. "Maire (64445)" → "Maire de Pau").
 *
 * Strategy:
 * 1. Find MAIRE mandates whose title matches "Maire (XXXXX)" pattern
 * 2. Resolve commune name via Commune table (id = INSEE code)
 * 3. Fallback: resolve via LocalOfficial.externalId → commune lookup
 * 4. Update title to "Maire de ${communeName}" and constituency to "${communeName} (${inseeCode})"
 *
 * Run: npx dotenv -e .env -- npx tsx scripts/tmp-fix-maire-mandates.ts
 */

async function main() {
  // Find all MAIRE mandates with raw INSEE code in title
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

  console.log(`Found ${maireMandates.length} MAIRE mandates with raw INSEE titles`);

  if (maireMandates.length === 0) {
    console.log("Nothing to fix!");
    await db.$disconnect();
    return;
  }

  // Pre-load commune names for batch resolution
  const allCommunes = await db.commune.findMany({
    select: { id: true, name: true },
  });
  const communeNameById = new Map(allCommunes.map((c) => [c.id, c.name]));
  console.log(`Loaded ${communeNameById.size} communes for lookup`);

  // Pre-load LocalOfficials for fallback resolution
  const officials = await db.localOfficial.findMany({
    where: { role: "MAIRE", politicianId: { not: null } },
    select: { politicianId: true, externalId: true, communeId: true },
  });
  const officialByPoliticianId = new Map(officials.map((o) => [o.politicianId!, o]));

  let fixed = 0;
  let skipped = 0;

  for (const mandate of maireMandates) {
    // Extract INSEE code from title "Maire (XXXXX)"
    const match = mandate.title.match(/^Maire \((\d{5})\)$/);
    if (!match) {
      // Try constituency field
      const inseeCode = mandate.constituency?.match(/^\d{5}$/)?.[0];
      if (!inseeCode) {
        console.log(`  SKIP: ${mandate.title} — cannot parse INSEE code`);
        skipped++;
        continue;
      }
      // Use constituency as fallback
      const communeName = communeNameById.get(inseeCode);
      if (!communeName) {
        console.log(`  SKIP: ${mandate.title} — commune ${inseeCode} not in DB`);
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
      continue;
    }

    const inseeCode = match[1];
    let communeName = communeNameById.get(inseeCode);

    // Fallback: check LocalOfficial for this politician
    if (!communeName && mandate.politicianId) {
      const official = officialByPoliticianId.get(mandate.politicianId);
      if (official?.communeId) {
        communeName = communeNameById.get(official.communeId);
      }
    }

    if (!communeName) {
      console.log(`  SKIP: ${mandate.title} — commune ${inseeCode} not found`);
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
  db.$disconnect();
  process.exit(1);
});
