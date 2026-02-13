/**
 * Migration script: reassign politicians from parliamentary groups to real parties
 *
 * This script:
 * 1. Finds politicians whose currentParty is actually a parliamentary group
 * 2. Reassigns them to the real party (via the group's defaultPartyId)
 * 3. Fixes UMP senators → LR
 * 4. Sets parliamentaryGroupId on active DEPUTE/SENATEUR mandates
 *
 * Usage:
 *   npx tsx scripts/migrate-groups-to-parties.ts              # Dry-run (default)
 *   npx tsx scripts/migrate-groups-to-parties.ts --execute    # Apply changes
 */

import "dotenv/config";
import { db } from "../src/lib/db";
import { MandateType } from "../src/generated/prisma";
import { politicianService } from "../src/services/politician";

const execute = process.argv.includes("--execute");

interface MigrationStats {
  reassigned: number;
  clearedToNull: number;
  umpToLr: number;
  mandatesLinked: number;
  wikidataFallback: number;
  skipped: number;
  errors: string[];
}

const stats: MigrationStats = {
  reassigned: 0,
  clearedToNull: 0,
  umpToLr: 0,
  mandatesLinked: 0,
  wikidataFallback: 0,
  skipped: 0,
  errors: [],
};

/**
 * Steps 1+2: Find Party records that are actually parliamentary groups and build
 * the mapping to real parties.
 *
 * Strategy: use the seeded ParliamentaryGroup table as source of truth.
 * For each ParliamentaryGroup code, find any Party with the same shortName.
 * A Party is a "group entry" if the ParliamentaryGroup's defaultPartyId points
 * to a DIFFERENT Party (or null for transpartisan). If defaultPartyId points to
 * the Party itself, it's the real party — skip it.
 */
async function buildGroupToPartyMap(): Promise<{
  groupParties: Map<string, { id: string; shortName: string; name: string }>;
  groupToParty: Map<string, string | null>;
}> {
  const groupParties = new Map<string, { id: string; shortName: string; name: string }>();
  const groupToParty = new Map<string, string | null>();

  // Load all seeded parliamentary groups
  const parlGroups = await db.parliamentaryGroup.findMany({
    select: { code: true, defaultPartyId: true },
  });

  // Load all parties indexed by shortName
  const allParties = await db.party.findMany({
    select: { id: true, shortName: true, name: true },
  });
  const partiesByShortName = new Map<string, { id: string; shortName: string; name: string }[]>();
  for (const p of allParties) {
    const list = partiesByShortName.get(p.shortName) ?? [];
    list.push(p);
    partiesByShortName.set(p.shortName, list);
  }

  for (const pg of parlGroups) {
    const candidates = partiesByShortName.get(pg.code) ?? [];
    for (const party of candidates) {
      // Skip if defaultPartyId points to this party itself (it IS the real party)
      if (pg.defaultPartyId === party.id) continue;

      groupParties.set(party.id, party);
      groupToParty.set(party.id, pg.defaultPartyId);
    }
  }

  return { groupParties, groupToParty };
}

/**
 * Step 3a: Reassign politicians from group parties to real parties
 */
async function reassignPoliticians(groupToParty: Map<string, string | null>): Promise<void> {
  console.log("\n--- Reassigning politicians from groups to parties ---");

  for (const [groupPartyId, realPartyId] of groupToParty) {
    const politicians = await db.politician.findMany({
      where: { currentPartyId: groupPartyId },
      select: { id: true, fullName: true },
    });

    if (politicians.length === 0) continue;

    const groupParty = await db.party.findUnique({
      where: { id: groupPartyId },
      select: { shortName: true, name: true },
    });

    if (realPartyId) {
      const realParty = await db.party.findUnique({
        where: { id: realPartyId },
        select: { shortName: true, name: true },
      });

      console.log(
        `  ${groupParty?.shortName} (${politicians.length} members) → ${realParty?.shortName} (${realParty?.name})`
      );

      if (execute) {
        for (const p of politicians) {
          try {
            await politicianService.setCurrentParty(p.id, realPartyId);
            stats.reassigned++;
          } catch (error) {
            stats.errors.push(`Failed to reassign ${p.fullName}: ${error}`);
          }
        }
      } else {
        stats.reassigned += politicians.length;
      }
    } else {
      console.log(
        `  ${groupParty?.shortName} (${politicians.length} members) → null (transpartisan group, no default party)`
      );

      if (execute) {
        for (const p of politicians) {
          try {
            await politicianService.setCurrentParty(p.id, null);
            stats.clearedToNull++;
          } catch (error) {
            stats.errors.push(`Failed to clear party for ${p.fullName}: ${error}`);
          }
        }
      } else {
        stats.clearedToNull += politicians.length;
      }
    }
  }
}

/**
 * Step 3b: Fix UMP senators → LR
 */
async function fixUmpSenators(): Promise<void> {
  console.log("\n--- Fixing UMP → LR ---");

  const umpParty = await db.party.findFirst({
    where: {
      OR: [{ shortName: "UMP" }, { name: "Union pour un Mouvement Populaire" }],
    },
    select: { id: true },
  });

  if (!umpParty) {
    console.log("  No UMP party found in database, skipping");
    return;
  }

  const lrParty = await db.party.findFirst({
    where: {
      OR: [{ shortName: "LR" }, { name: "Les Républicains" }],
    },
    select: { id: true, shortName: true },
  });

  if (!lrParty) {
    console.log("  No LR party found in database, skipping");
    return;
  }

  // Don't reassign UMP politicians who have an explicit different party via Wikidata
  // Only reassign those whose current party is UMP
  const umpPoliticians = await db.politician.findMany({
    where: { currentPartyId: umpParty.id },
    select: { id: true, fullName: true },
  });

  console.log(`  ${umpPoliticians.length} politicians still under UMP → reassigning to LR`);

  if (execute) {
    for (const p of umpPoliticians) {
      try {
        await politicianService.setCurrentParty(p.id, lrParty.id);
        stats.umpToLr++;
      } catch (error) {
        stats.errors.push(`Failed to reassign UMP→LR for ${p.fullName}: ${error}`);
      }
    }
  } else {
    stats.umpToLr += umpPoliticians.length;
  }
}

/**
 * Step 4: Link mandates to parliamentary groups
 */
async function linkMandatesToGroups(): Promise<void> {
  console.log("\n--- Linking mandates to parliamentary groups ---");

  // Load all parliamentary groups
  const parlGroups = await db.parliamentaryGroup.findMany({
    select: { id: true, code: true, chamber: true },
  });

  const anGroupMap = new Map<string, string>();
  const senatGroupMap = new Map<string, string>();

  for (const pg of parlGroups) {
    if (pg.chamber === "AN") {
      anGroupMap.set(pg.code, pg.id);
    } else {
      senatGroupMap.set(pg.code, pg.id);
    }
  }

  // Find all current DEPUTE and SENATEUR mandates that don't have a parliamentaryGroupId yet
  const mandates = await db.mandate.findMany({
    where: {
      isCurrent: true,
      type: { in: [MandateType.DEPUTE, MandateType.SENATEUR] },
      parliamentaryGroupId: null,
    },
    select: {
      id: true,
      type: true,
      politicianId: true,
      politician: {
        select: {
          fullName: true,
          currentParty: {
            select: { id: true, shortName: true, name: true },
          },
        },
      },
    },
  });

  console.log(`  ${mandates.length} mandates to process`);

  let linked = 0;
  for (const mandate of mandates) {
    const groupMap = mandate.type === MandateType.DEPUTE ? anGroupMap : senatGroupMap;
    const currentPartyShortName = mandate.politician.currentParty?.shortName;

    if (!currentPartyShortName) continue;

    // Try to match by the party's shortName (which was originally the group code)
    const groupId = groupMap.get(currentPartyShortName);

    if (groupId) {
      if (execute) {
        await db.mandate.update({
          where: { id: mandate.id },
          data: { parliamentaryGroupId: groupId },
        });
      }
      linked++;
    }
  }

  stats.mandatesLinked = linked;
  console.log(`  ${linked} mandates linked to parliamentary groups`);
}

async function main() {
  console.log(execute ? "=== EXECUTING MIGRATION ===" : "=== DRY-RUN MODE ===");
  console.log("(Use --execute to apply changes)\n");

  // Find group parties and build mapping
  const { groupParties, groupToParty } = await buildGroupToPartyMap();
  console.log(`Found ${groupParties.size} parliamentary group entries in Party table`);
  for (const [, party] of groupParties) {
    const count = await db.politician.count({ where: { currentPartyId: party.id } });
    if (count > 0) {
      console.log(`  ${party.shortName} (${party.name}): ${count} members`);
    }
  }

  // Reassign politicians
  await reassignPoliticians(groupToParty);

  // Fix UMP → LR
  await fixUmpSenators();

  // Link mandates to parliamentary groups
  await linkMandatesToGroups();

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("MIGRATION SUMMARY");
  console.log("=".repeat(60));
  console.log(`  Politicians reassigned to real party: ${stats.reassigned}`);
  console.log(`  Politicians cleared to null (transpartisan): ${stats.clearedToNull}`);
  console.log(`  UMP → LR corrections: ${stats.umpToLr}`);
  console.log(`  Mandates linked to parliamentary group: ${stats.mandatesLinked}`);
  if (stats.errors.length > 0) {
    console.log(`\n  ERRORS (${stats.errors.length}):`);
    for (const err of stats.errors) {
      console.log(`    - ${err}`);
    }
  }

  if (!execute) {
    console.log("\nThis was a DRY-RUN. Use --execute to apply changes.");
  }

  process.exit(0);
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
