/**
 * Fix script for Priority 2 audit issues (#72)
 *
 * 1. Fix aberrant death dates (Philippe Paul, Jean-Baptiste Blanc)
 * 2. Fix duplicate deputies (579 → 577)
 * 3. Fix extra MEPs (91 → 81)
 * 4. Reclassify AUTRE affairs where a better category exists
 *
 * Usage:
 *   npx tsx scripts/fix-audit-p2.ts --dry-run
 *   npx tsx scripts/fix-audit-p2.ts
 */

import "dotenv/config";
import { db } from "../src/lib/db";
import { AffairCategory } from "../src/generated/prisma";

const DRY_RUN = process.argv.includes("--dry-run");

// Mapping of affair titles to correct categories
const AFFAIR_RECLASSIFICATION: Record<string, AffairCategory> = {
  "Incitation à la haine raciale": AffairCategory.INCITATION_HAINE,
  "Incitation à la haine": AffairCategory.INCITATION_HAINE,
  Homophobie: AffairCategory.INCITATION_HAINE,
  "Discours de haine": AffairCategory.INCITATION_HAINE,
  "Voie de fait": AffairCategory.VIOLENCE,
  "Voies de fait": AffairCategory.VIOLENCE,
  "Financement illégal de campagne électorale": AffairCategory.FINANCEMENT_ILLEGAL_CAMPAGNE,
  "Financement illégal de campagne": AffairCategory.FINANCEMENT_ILLEGAL_CAMPAGNE,
  Escroquerie: AffairCategory.ABUS_CONFIANCE,
  "Fraude électorale": AffairCategory.FRAUDE_FISCALE, // closest match
};

async function main() {
  console.log(`=== Fix Audit P2 Issues (#72) ===`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);

  // ──────────────────────────────────────────────────────────
  // FIX 1: Aberrant death dates
  // ──────────────────────────────────────────────────────────
  console.log("── Fix 1: Aberrant death dates ──");

  const aberrantDeaths = await db.politician.findMany({
    where: { deathDate: { lt: new Date("1900-01-01") } },
    select: { id: true, fullName: true, deathDate: true, birthDate: true },
  });

  for (const p of aberrantDeaths) {
    if (DRY_RUN) {
      console.log(
        `  [DRY-RUN] Would clear deathDate for ${p.fullName} (was ${p.deathDate?.toISOString().split("T")[0]})`
      );
    } else {
      await db.politician.update({
        where: { id: p.id },
        data: { deathDate: null },
      });
      console.log(`  ✓ Cleared deathDate for ${p.fullName}`);
    }
  }
  console.log(`  Fixed: ${aberrantDeaths.length}\n`);

  // ──────────────────────────────────────────────────────────
  // FIX 2: Duplicate deputy mandates (579 → 577)
  // ──────────────────────────────────────────────────────────
  console.log("── Fix 2: Duplicate deputies ──");

  const deputies = await db.mandate.findMany({
    where: { type: "DEPUTE", isCurrent: true },
    include: { politician: { select: { fullName: true } } },
    orderBy: { startDate: "asc" },
  });

  // Group by politician, find duplicates
  const deputyGroups = new Map<string, typeof deputies>();
  for (const d of deputies) {
    if (!deputyGroups.has(d.politicianId)) deputyGroups.set(d.politicianId, []);
    deputyGroups.get(d.politicianId)!.push(d);
  }

  let deputyDupsRemoved = 0;
  for (const [, mandates] of deputyGroups) {
    if (mandates.length <= 1) continue;

    // Keep the most specific one (from AN, with a circumscription in title)
    // or the most recent one
    const sorted = mandates.sort((a, b) => {
      // Prefer mandates with specific titles (circumscription)
      const aSpecific = a.title?.includes("circonscription") ? 1 : 0;
      const bSpecific = b.title?.includes("circonscription") ? 1 : 0;
      if (aSpecific !== bSpecific) return bSpecific - aSpecific;
      // Then prefer most recent
      return (b.startDate?.getTime() ?? 0) - (a.startDate?.getTime() ?? 0);
    });

    const keep = sorted[0];
    const toClose = sorted.slice(1);

    for (const m of toClose) {
      if (DRY_RUN) {
        console.log(
          `  [DRY-RUN] Would close duplicate: ${m.politician.fullName} - "${m.title}" (keep: "${keep.title}")`
        );
      } else {
        await db.mandate.update({
          where: { id: m.id },
          data: { isCurrent: false, endDate: keep.startDate },
        });
      }
      deputyDupsRemoved++;
    }
  }
  console.log(`  Duplicates closed: ${deputyDupsRemoved}`);
  console.log(`  Deputies now: ${deputies.length - deputyDupsRemoved}\n`);

  // ──────────────────────────────────────────────────────────
  // FIX 3: Extra MEPs (91 → 81)
  // ──────────────────────────────────────────────────────────
  console.log("── Fix 3: Extra MEPs ──");

  const meps = await db.mandate.findMany({
    where: { type: "DEPUTE_EUROPEEN", isCurrent: true },
    include: { politician: { select: { fullName: true } } },
    orderBy: { startDate: "asc" },
  });
  console.log(`  Current MEPs: ${meps.length}`);

  // The current legislature started 2024-07-16
  // Close all mandates from before that date (old legislature)
  const cutoffDate = new Date("2024-07-16");
  const oldMeps = meps.filter((m) => m.startDate && m.startDate < cutoffDate);

  for (const m of oldMeps) {
    if (DRY_RUN) {
      console.log(
        `  [DRY-RUN] Would close old MEP: ${m.politician.fullName} (start: ${m.startDate?.toISOString().split("T")[0]})`
      );
    } else {
      await db.mandate.update({
        where: { id: m.id },
        data: { isCurrent: false, endDate: cutoffDate },
      });
    }
  }
  console.log(`  Old legislature MEPs closed: ${oldMeps.length}`);

  // Now check for duplicates in the current legislature
  const currentMeps = meps.filter((m) => !m.startDate || m.startDate >= cutoffDate);
  const mepGroups = new Map<string, typeof currentMeps>();
  for (const m of currentMeps) {
    if (!mepGroups.has(m.politicianId)) mepGroups.set(m.politicianId, []);
    mepGroups.get(m.politicianId)!.push(m);
  }

  let mepDupsRemoved = 0;
  for (const [, mandates] of mepGroups) {
    if (mandates.length <= 1) continue;
    // Keep the most recent
    const sorted = mandates.sort(
      (a, b) => (b.startDate?.getTime() ?? 0) - (a.startDate?.getTime() ?? 0)
    );
    for (const m of sorted.slice(1)) {
      if (DRY_RUN) {
        console.log(`  [DRY-RUN] Would close MEP duplicate: ${m.politician.fullName}`);
      } else {
        await db.mandate.update({
          where: { id: m.id },
          data: { isCurrent: false, endDate: sorted[0].startDate },
        });
      }
      mepDupsRemoved++;
    }
  }
  console.log(`  Current legislature duplicates closed: ${mepDupsRemoved}`);
  console.log(`  MEPs now: ${meps.length - oldMeps.length - mepDupsRemoved}\n`);

  // ──────────────────────────────────────────────────────────
  // FIX 4: Reclassify AUTRE affairs
  // ──────────────────────────────────────────────────────────
  console.log("── Fix 4: Reclassify AUTRE affairs ──");

  const autreAffairs = await db.affair.findMany({
    where: { category: "AUTRE" },
    include: { politician: { select: { fullName: true } } },
  });

  let reclassified = 0;
  let keptAutre = 0;
  for (const a of autreAffairs) {
    const newCategory = AFFAIR_RECLASSIFICATION[a.title];
    if (newCategory) {
      if (DRY_RUN) {
        console.log(`  [DRY-RUN] ${a.politician.fullName} - "${a.title}": AUTRE → ${newCategory}`);
      } else {
        await db.affair.update({
          where: { id: a.id },
          data: { category: newCategory },
        });
        console.log(`  ✓ ${a.politician.fullName} - "${a.title}" → ${newCategory}`);
      }
      reclassified++;
    } else {
      console.log(`  [SKIP] ${a.politician.fullName} - "${a.title}" — no matching category`);
      keptAutre++;
    }
  }
  console.log(`  Reclassified: ${reclassified}, kept AUTRE: ${keptAutre}\n`);

  // ──────────────────────────────────────────────────────────
  // Summary
  // ──────────────────────────────────────────────────────────
  console.log("=".repeat(50));
  console.log("Summary:");
  console.log(`  1. Death dates fixed: ${aberrantDeaths.length}`);
  console.log(`  2. Deputy duplicates closed: ${deputyDupsRemoved}`);
  console.log(`  3. MEPs closed: ${oldMeps.length + mepDupsRemoved}`);
  console.log(`  4. Affairs reclassified: ${reclassified}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
