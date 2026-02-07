/**
 * Script d'audit et nettoyage des partis orphelins
 *
 * Identifie les partis sans aucune référence (politicians, memberships,
 * affaires, presse, successeurs) et permet de les supprimer.
 *
 * Usage :
 *   npx tsx scripts/audit-parties.ts              # Audit complet
 *   npx tsx scripts/audit-parties.ts --stats       # Stats rapides
 *   npx tsx scripts/audit-parties.ts --clean       # Preview suppressions (dry-run)
 *   npx tsx scripts/audit-parties.ts --clean --confirm  # Suppression réelle
 */

import "dotenv/config";
import { createCLI, type SyncHandler, type SyncResult } from "../src/lib/sync";
import { db } from "../src/lib/db";
import { DataSource } from "../src/generated/prisma";

interface PartyAuditInfo {
  id: string;
  name: string;
  shortName: string;
  dissolvedDate: Date | null;
  politicians: number;
  partyMemberships: number;
  affairsAtTime: number;
  pressMentions: number;
  successors: number;
  hasWikidata: boolean;
}

async function fetchPartiesWithCounts(): Promise<PartyAuditInfo[]> {
  const parties = await db.party.findMany({
    include: {
      _count: {
        select: {
          politicians: true,
          partyMemberships: true,
          affairsAtTime: true,
          pressMentions: true,
          successors: true,
        },
      },
      externalIds: {
        where: { source: DataSource.WIKIDATA },
        select: { id: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return parties.map((p) => ({
    id: p.id,
    name: p.name,
    shortName: p.shortName,
    dissolvedDate: p.dissolvedDate,
    politicians: p._count.politicians,
    partyMemberships: p._count.partyMemberships,
    affairsAtTime: p._count.affairsAtTime,
    pressMentions: p._count.pressMentions,
    successors: p._count.successors,
    hasWikidata: p.externalIds.length > 0,
  }));
}

function isDeletable(p: PartyAuditInfo): boolean {
  return (
    p.politicians === 0 &&
    p.partyMemberships === 0 &&
    p.affairsAtTime === 0 &&
    p.pressMentions === 0 &&
    p.successors === 0
  );
}

function findDuplicates(
  parties: PartyAuditInfo[]
): Array<[PartyAuditInfo, PartyAuditInfo]> {
  const duplicates: Array<[PartyAuditInfo, PartyAuditInfo]> = [];
  const seen = new Map<string, PartyAuditInfo>();

  for (const party of parties) {
    const key = party.shortName.toLowerCase();
    if (seen.has(key)) {
      duplicates.push([seen.get(key)!, party]);
    } else {
      seen.set(key, party);
    }
  }

  return duplicates;
}

const handler: SyncHandler = {
  name: "Politic Tracker - Party Audit",
  description: "Audit and clean orphan parties",

  options: [
    {
      name: "--clean",
      type: "boolean",
      description: "Delete orphan parties (dry-run unless --confirm)",
    },
    {
      name: "--confirm",
      type: "boolean",
      description: "Actually delete (requires --clean)",
    },
  ],

  showHelp() {
    console.log(`
Politic Tracker - Party Audit

Identifies parties with no references (no politicians, memberships,
affairs, press mentions, or successors) and optionally removes them.

Modes:
  (default)           Full audit report
  --stats             Quick statistics
  --clean             Preview deletions (dry-run)
  --clean --confirm   Actually delete orphan parties
    `);
  },

  async showStats() {
    const parties = await fetchPartiesWithCounts();
    const deletable = parties.filter(isDeletable);
    const withPoliticians = parties.filter((p) => p.politicians > 0);
    const withMemberships = parties.filter(
      (p) => p.partyMemberships > 0 && p.politicians === 0
    );
    const dissolved = parties.filter((p) => p.dissolvedDate !== null);
    const withWikidata = parties.filter((p) => p.hasWikidata);

    console.log("\n" + "=".repeat(50));
    console.log("Party Stats");
    console.log("=".repeat(50));
    console.log(`Total parties:              ${parties.length}`);
    console.log(`With current politicians:   ${withPoliticians.length}`);
    console.log(`With memberships only:      ${withMemberships.length}`);
    console.log(`Dissolved:                  ${dissolved.length}`);
    console.log(`With Wikidata ID:           ${withWikidata.length}`);
    console.log(`Orphans (deletable):        ${deletable.length}`);
  },

  async sync(options): Promise<SyncResult> {
    const { clean = false, confirm = false } = options as {
      clean?: boolean;
      confirm?: boolean;
    };

    const stats = {
      totalParties: 0,
      orphans: 0,
      keptWithMemberships: 0,
      keptWithAffairs: 0,
      keptWithPress: 0,
      keptWithSuccessors: 0,
      duplicates: 0,
      withoutWikidata: 0,
      deleted: 0,
    };
    const errors: string[] = [];

    console.log("Fetching parties with reference counts...");
    const parties = await fetchPartiesWithCounts();
    stats.totalParties = parties.length;
    console.log(`Found ${parties.length} parties\n`);

    // Classify parties
    const orphans: PartyAuditInfo[] = [];
    const keptWithMemberships: PartyAuditInfo[] = [];
    const keptWithAffairs: PartyAuditInfo[] = [];
    const keptWithPress: PartyAuditInfo[] = [];
    const keptWithSuccessors: PartyAuditInfo[] = [];
    const withoutWikidata: PartyAuditInfo[] = [];

    for (const party of parties) {
      if (!party.hasWikidata) {
        withoutWikidata.push(party);
      }

      if (party.politicians > 0) continue; // Has current members, skip

      if (isDeletable(party)) {
        orphans.push(party);
      } else {
        if (party.partyMemberships > 0) keptWithMemberships.push(party);
        if (party.affairsAtTime > 0) keptWithAffairs.push(party);
        if (party.pressMentions > 0) keptWithPress.push(party);
        if (party.successors > 0) keptWithSuccessors.push(party);
      }
    }

    stats.orphans = orphans.length;
    stats.keptWithMemberships = keptWithMemberships.length;
    stats.keptWithAffairs = keptWithAffairs.length;
    stats.keptWithPress = keptWithPress.length;
    stats.keptWithSuccessors = keptWithSuccessors.length;
    stats.withoutWikidata = withoutWikidata.length;

    const duplicates = findDuplicates(parties);
    stats.duplicates = duplicates.length;

    if (!clean) {
      // Full audit report
      console.log("=".repeat(60));
      console.log("AUDIT REPORT - PARTIES");
      console.log("=".repeat(60));
      console.log();

      // Orphans
      console.log(`ORPHAN PARTIES - DELETABLE (${orphans.length})`);
      console.log("-".repeat(50));
      if (orphans.length === 0) {
        console.log("  None\n");
      } else {
        for (const p of orphans) {
          const dissolved = p.dissolvedDate
            ? ` (dissolved ${p.dissolvedDate.getFullYear()})`
            : "";
          const wikidata = p.hasWikidata ? "" : " [no Wikidata]";
          console.log(
            `  - ${p.shortName}: ${p.name}${dissolved}${wikidata}`
          );
        }
        console.log();
      }

      // Kept with memberships
      if (keptWithMemberships.length > 0) {
        console.log(
          `PARTIES WITH MEMBERSHIPS ONLY (${keptWithMemberships.length}) - keep`
        );
        console.log("-".repeat(50));
        for (const p of keptWithMemberships) {
          console.log(
            `  - ${p.shortName}: ${p.name} (${p.partyMemberships} memberships)`
          );
        }
        console.log();
      }

      // Kept with affairs
      if (keptWithAffairs.length > 0) {
        console.log(
          `PARTIES WITH AFFAIRS (${keptWithAffairs.length}) - keep`
        );
        console.log("-".repeat(50));
        for (const p of keptWithAffairs) {
          console.log(
            `  - ${p.shortName}: ${p.name} (${p.affairsAtTime} affairs)`
          );
        }
        console.log();
      }

      // Kept with press
      if (keptWithPress.length > 0) {
        console.log(
          `PARTIES WITH PRESS MENTIONS (${keptWithPress.length}) - keep`
        );
        console.log("-".repeat(50));
        for (const p of keptWithPress) {
          console.log(
            `  - ${p.shortName}: ${p.name} (${p.pressMentions} mentions)`
          );
        }
        console.log();
      }

      // Kept with successors
      if (keptWithSuccessors.length > 0) {
        console.log(
          `PARTIES IN SUCCESSION CHAIN (${keptWithSuccessors.length}) - keep`
        );
        console.log("-".repeat(50));
        for (const p of keptWithSuccessors) {
          console.log(
            `  - ${p.shortName}: ${p.name} (${p.successors} successors)`
          );
        }
        console.log();
      }

      // Duplicates
      if (duplicates.length > 0) {
        console.log(`POTENTIAL DUPLICATES (${duplicates.length})`);
        console.log("-".repeat(50));
        for (const [a, b] of duplicates) {
          console.log(
            `  - "${a.shortName}" (${a.name}) vs "${b.shortName}" (${b.name})`
          );
        }
        console.log();
      }

      // Without Wikidata
      if (withoutWikidata.length > 0) {
        console.log(
          `PARTIES WITHOUT WIKIDATA ID (${withoutWikidata.length})`
        );
        console.log("-".repeat(50));
        for (const p of withoutWikidata.slice(0, 20)) {
          console.log(`  - ${p.shortName}: ${p.name}`);
        }
        if (withoutWikidata.length > 20) {
          console.log(`  ... and ${withoutWikidata.length - 20} more`);
        }
        console.log();
      }

      console.log("=".repeat(60));
      console.log("RECOMMENDATIONS");
      console.log("=".repeat(60));
      console.log();
      if (orphans.length > 0) {
        console.log(
          `Run with --clean --confirm to delete ${orphans.length} orphan parties.`
        );
        console.log("Run with --clean to preview deletions first (dry-run).");
      } else {
        console.log("No orphan parties to clean up.");
      }
      console.log();
    } else {
      // Clean mode
      const isDryRun = !confirm;

      console.log(
        isDryRun
          ? "DRY-RUN: Preview of parties to delete"
          : "DELETING orphan parties..."
      );
      console.log("-".repeat(50));

      if (orphans.length === 0) {
        console.log("  No orphan parties to delete.\n");
      } else {
        for (const p of orphans) {
          const dissolved = p.dissolvedDate
            ? ` (dissolved ${p.dissolvedDate.getFullYear()})`
            : "";

          if (isDryRun) {
            console.log(
              `  [DRY-RUN] Would delete: ${p.shortName} - ${p.name}${dissolved}`
            );
          } else {
            try {
              await db.externalId.deleteMany({ where: { partyId: p.id } });
              await db.party.delete({ where: { id: p.id } });
              console.log(
                `  Deleted: ${p.shortName} - ${p.name}${dissolved}`
              );
              stats.deleted++;
            } catch (error) {
              const msg = `Failed to delete ${p.shortName}: ${error}`;
              console.log(`  ERROR: ${msg}`);
              errors.push(msg);
            }
          }
        }
        console.log();

        if (isDryRun) {
          console.log(
            `\n${orphans.length} parties would be deleted. Run with --confirm to execute.`
          );
        } else {
          console.log(`\nDeleted ${stats.deleted} orphan parties.`);
        }
      }
    }

    return {
      success: errors.length === 0,
      duration: 0,
      stats,
      errors,
    };
  },
};

createCLI(handler);
