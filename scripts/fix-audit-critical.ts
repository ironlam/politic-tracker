/**
 * One-time fix script for the 5 critical audit issues (#72)
 *
 * 1. Remove duplicate government mandates (same politician, same type, 1 day apart)
 * 2. Close ghost ministers (mandates from before 2024 still marked current)
 * 3. Fix 9 false PRESIDENT_REPUBLIQUE mandates (Wikidata import bug)
 * 4. Fill politicalPosition for all major parties
 * 5. Fix party leaders (close obsolete, flag missing)
 *
 * Usage:
 *   npx tsx scripts/fix-audit-critical.ts --dry-run
 *   npx tsx scripts/fix-audit-critical.ts
 */

import "dotenv/config";
import { db } from "../src/lib/db";
import { PoliticalPosition } from "../src/generated/prisma";

const DRY_RUN = process.argv.includes("--dry-run");

// Known political positions for French parties
const PARTY_POSITIONS: Record<string, PoliticalPosition> = {
  RN: PoliticalPosition.FAR_RIGHT,
  FN: PoliticalPosition.FAR_RIGHT,
  REC: PoliticalPosition.FAR_RIGHT,
  MNR: PoliticalPosition.FAR_RIGHT,
  PFN: PoliticalPosition.FAR_RIGHT,
  CNIP: PoliticalPosition.FAR_RIGHT,
  Jeanne: PoliticalPosition.FAR_RIGHT,

  LR: PoliticalPosition.RIGHT,
  UMP: PoliticalPosition.RIGHT,
  RPR: PoliticalPosition.RIGHT,
  DR: PoliticalPosition.RIGHT,
  CPNT: PoliticalPosition.RIGHT,
  "LR-hist": PoliticalPosition.RIGHT,

  UDI: PoliticalPosition.CENTER_RIGHT,
  HOR: PoliticalPosition.CENTER_RIGHT,
  Agir: PoliticalPosition.CENTER_RIGHT,
  PR: PoliticalPosition.CENTER_RIGHT,
  CDS: PoliticalPosition.CENTER_RIGHT,
  PRV: PoliticalPosition.CENTER_RIGHT,

  RE: PoliticalPosition.CENTER,
  EPR: PoliticalPosition.CENTER,
  LREM: PoliticalPosition.CENTER,
  MoDem: PoliticalPosition.CENTER,
  DEM: PoliticalPosition.CENTER,
  UDF: PoliticalPosition.CENTER,
  UC: PoliticalPosition.CENTER,
  RDSE: PoliticalPosition.CENTER,
  PP: PoliticalPosition.CENTER,
  "L'APRÈS": PoliticalPosition.CENTER,
  MR: PoliticalPosition.CENTER,

  PS: PoliticalPosition.LEFT,
  SOC: PoliticalPosition.LEFT,
  EELV: PoliticalPosition.LEFT,
  ECOS: PoliticalPosition.LEFT,
  GEST: PoliticalPosition.LEFT,
  PRG: PoliticalPosition.LEFT,
  PG: PoliticalPosition.LEFT,
  GRS: PoliticalPosition.LEFT,
  REV: PoliticalPosition.LEFT,
  "G.s": PoliticalPosition.LEFT,

  LFI: PoliticalPosition.FAR_LEFT,
  "LFI-NFP": PoliticalPosition.FAR_LEFT,
  PCF: PoliticalPosition.FAR_LEFT,
  GDR: PoliticalPosition.FAR_LEFT,
  NPA: PoliticalPosition.FAR_LEFT,
  PCR: PoliticalPosition.FAR_LEFT,
  PCB: PoliticalPosition.FAR_LEFT,
  PCI: PoliticalPosition.FAR_LEFT,
  CRC: PoliticalPosition.FAR_LEFT,
};

async function main() {
  console.log(`=== Fix Audit Critical Issues (#72) ===`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);

  // ──────────────────────────────────────────────────────────
  // FIX 1: Remove duplicate government mandates
  // ──────────────────────────────────────────────────────────
  console.log("── Fix 1: Duplicate government mandates ──");

  const govMandates = await db.mandate.findMany({
    where: {
      type: { in: ["MINISTRE", "MINISTRE_DELEGUE", "SECRETAIRE_ETAT", "PREMIER_MINISTRE"] },
      isCurrent: true,
    },
    orderBy: [{ politicianId: "asc" }, { startDate: "asc" }],
  });

  // Group by politician+type, keep the one with the earliest start date
  const groups = new Map<string, typeof govMandates>();
  for (const m of govMandates) {
    const key = `${m.politicianId}-${m.type}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }

  let duplicatesDeleted = 0;
  for (const [, mandates] of groups) {
    if (mandates.length <= 1) continue;
    // Keep the first, delete the rest
    const toDelete = mandates.slice(1);
    for (const m of toDelete) {
      if (DRY_RUN) {
        console.log(
          `  [DRY-RUN] Would delete duplicate: ${m.id} (${m.startDate.toISOString().split("T")[0]})`
        );
      } else {
        await db.mandate.delete({ where: { id: m.id } });
      }
      duplicatesDeleted++;
    }
  }
  console.log(`  Duplicates removed: ${duplicatesDeleted}\n`);

  // ──────────────────────────────────────────────────────────
  // FIX 2: Close ghost ministers (started before 2024)
  // ──────────────────────────────────────────────────────────
  console.log("── Fix 2: Ghost ministers ──");

  const ghosts = await db.mandate.findMany({
    where: {
      type: { in: ["MINISTRE", "MINISTRE_DELEGUE", "SECRETAIRE_ETAT"] },
      isCurrent: true,
      startDate: { lt: new Date("2024-01-01") },
    },
    include: { politician: { select: { fullName: true } } },
  });

  for (const m of ghosts) {
    // These ministers haven't been in office since at least 2022
    // Close them with a conservative end date (end of their likely government)
    const endDate =
      m.startDate < new Date("2000-01-01")
        ? new Date("2002-05-06") // Pre-2000: ended at latest with Jospin government
        : new Date("2022-05-20"); // 2020 era: ended with Macron 1st term

    if (DRY_RUN) {
      console.log(
        `  [DRY-RUN] Would close: ${m.politician.fullName} - ${m.title} (since ${m.startDate.toISOString().split("T")[0]})`
      );
    } else {
      await db.mandate.update({
        where: { id: m.id },
        data: { isCurrent: false, endDate },
      });
    }
  }
  console.log(`  Ghost ministers closed: ${ghosts.length}\n`);

  // ──────────────────────────────────────────────────────────
  // FIX 3: Fix false PRESIDENT_REPUBLIQUE mandates
  // ──────────────────────────────────────────────────────────
  console.log("── Fix 3: False PRESIDENT_REPUBLIQUE ──");

  const falsePresidents = await db.mandate.findMany({
    where: {
      type: "PRESIDENT_REPUBLIQUE",
      isCurrent: true,
      // The real one has no externalId starting with wikidata
      externalId: { startsWith: "wikidata-" },
    },
    include: { politician: { select: { fullName: true } } },
  });

  for (const m of falsePresidents) {
    // These are "président ou présidente" of local bodies, misclassified
    // Delete them — they were created by sync-careers from Wikidata Q30461
    // which matched "president" generically
    if (DRY_RUN) {
      console.log(
        `  [DRY-RUN] Would delete: ${m.politician.fullName} - "${m.title}" (ext: ${m.externalId})`
      );
    } else {
      await db.mandate.delete({ where: { id: m.id } });
    }
  }
  console.log(`  False PRESIDENT_REPUBLIQUE deleted: ${falsePresidents.length}\n`);

  // ──────────────────────────────────────────────────────────
  // FIX 4: Fill politicalPosition for all parties
  // ──────────────────────────────────────────────────────────
  console.log("── Fix 4: Political positions ──");

  const partiesNoPos = await db.party.findMany({
    where: { politicalPosition: null },
    select: { id: true, shortName: true, name: true },
  });

  let positionsSet = 0;
  let positionsUnknown = 0;
  for (const party of partiesNoPos) {
    const position = PARTY_POSITIONS[party.shortName];
    if (!position) {
      // Try without case
      const found = Object.entries(PARTY_POSITIONS).find(
        ([key]) => key.toLowerCase() === party.shortName.toLowerCase()
      );
      if (!found) {
        console.log(`  [SKIP] No position known for "${party.shortName}" (${party.name})`);
        positionsUnknown++;
        continue;
      }
    }

    const pos =
      position ||
      PARTY_POSITIONS[
        Object.keys(PARTY_POSITIONS).find((k) => k.toLowerCase() === party.shortName.toLowerCase())!
      ];

    if (DRY_RUN) {
      console.log(`  [DRY-RUN] ${party.shortName} → ${pos}`);
    } else {
      await db.party.update({
        where: { id: party.id },
        data: { politicalPosition: pos },
      });
    }
    positionsSet++;
  }
  console.log(`  Positions set: ${positionsSet}, unknown: ${positionsUnknown}\n`);

  // ──────────────────────────────────────────────────────────
  // FIX 5: Party leaders
  // ──────────────────────────────────────────────────────────
  console.log("── Fix 5: Party leaders ──");

  // 5a. Close Marine Le Pen's FN leadership (party renamed to RN, Bardella is president)
  const lePenFN = await db.mandate.findFirst({
    where: {
      type: "PRESIDENT_PARTI",
      isCurrent: true,
      institution: "Front national",
    },
    include: { politician: { select: { fullName: true } } },
  });

  if (lePenFN) {
    if (DRY_RUN) {
      console.log(`  [DRY-RUN] Would close: ${lePenFN.politician.fullName} - FN leader`);
    } else {
      await db.mandate.update({
        where: { id: lePenFN.id },
        data: { isCurrent: false, endDate: new Date("2018-06-01") },
      });
    }
    console.log(`  Closed Le Pen FN mandate`);
  }

  // 5b. Close David Cormand EELV leadership (Tondelier since Dec 2022)
  const cormandEELV = await db.mandate.findFirst({
    where: {
      type: "PRESIDENT_PARTI",
      isCurrent: true,
      politician: { fullName: { contains: "Cormand" } },
    },
    include: { politician: { select: { fullName: true } } },
  });

  if (cormandEELV) {
    if (DRY_RUN) {
      console.log(`  [DRY-RUN] Would close: ${cormandEELV.politician.fullName} - EELV leader`);
    } else {
      await db.mandate.update({
        where: { id: cormandEELV.id },
        data: { isCurrent: false, endDate: new Date("2019-11-30") },
      });
    }
    console.log(`  Closed Cormand EELV mandate`);
  }

  // 5c. Report missing leaders for manual action
  const missingLeaders = [
    { party: "EELV", leader: "Marine Tondelier", since: "2022-12" },
    { party: "LR", leader: "Bruno Retailleau", since: "2025-05" },
    { party: "PCF", leader: "Fabien Roussel", since: "2018-11" },
  ];

  console.log("\n  Missing leaders (need manual addition or next populate run):");
  for (const { party, leader, since } of missingLeaders) {
    // Check if they exist in DB
    const politician = await db.politician.findFirst({
      where: { fullName: { contains: leader.split(" ")[1], mode: "insensitive" } },
      select: { fullName: true, id: true },
    });
    const status = politician ? `in DB (${politician.fullName})` : "NOT IN DB";
    console.log(`    ${party}: ${leader} (since ${since}) — ${status}`);
  }

  // ──────────────────────────────────────────────────────────
  // Summary
  // ──────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(50));
  console.log("Summary:");
  console.log(`  1. Duplicates deleted: ${duplicatesDeleted}`);
  console.log(`  2. Ghost ministers closed: ${ghosts.length}`);
  console.log(`  3. False PRESIDENT_REPUBLIQUE deleted: ${falsePresidents.length}`);
  console.log(`  4. Political positions set: ${positionsSet} (${positionsUnknown} unknown)`);
  console.log(`  5. Obsolete leaders closed: ${(lePenFN ? 1 : 0) + (cormandEELV ? 1 : 0)}`);
  console.log(`\nManual actions remaining:`);
  console.log(`  - Add Marine Tondelier as EELV leader`);
  console.log(`  - Add Bruno Retailleau as LR leader`);
  console.log(`  - Add Fabien Roussel as PCF leader (may need to create politician)`);
  console.log(`  - Run sync:gouvernement to get Lecornu II government`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
