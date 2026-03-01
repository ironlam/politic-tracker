/**
 * CLI script to associate French MEPs with their national political party
 *
 * Uses Wikidata P102 (member of political party) to find the national party
 * for each MEP. Requires MEPs to have Wikidata IDs (run sync-wikidata-ids first).
 *
 * Usage:
 *   npm run sync:mep-parties              # Sync parties for all MEPs
 *   npm run sync:mep-parties -- --stats   # Show current stats
 *   npm run sync:mep-parties -- --dry-run # Preview without saving
 *   npm run sync:mep-parties -- --limit=50 # Process only 50 MEPs
 *   npm run sync:mep-parties -- --force   # Overwrite existing party assignments
 */

import "dotenv/config";
import { createCLI, ProgressTracker, type SyncHandler, type SyncResult } from "../src/lib/sync";
import { WikidataService } from "../src/lib/api";
import type { WikidataPartyAffiliation } from "../src/lib/api";
import { db } from "../src/lib/db";
import { DataSource, MandateType } from "../src/generated/prisma";
import { politicianService } from "../src/services/politician";
import { WIKIDATA_SPARQL_RATE_LIMIT_MS } from "../src/config/rate-limits";

/**
 * Find the current party affiliation from a list of Wikidata P102 claims.
 * Prefers the one with no endDate; otherwise picks the most recent startDate.
 */
function findCurrentAffiliation(
  affiliations: WikidataPartyAffiliation[]
): WikidataPartyAffiliation | null {
  if (affiliations.length === 0) return null;

  // Prefer affiliations with no end date (= current)
  const current = affiliations.filter((a) => !a.endDate);
  if (current.length === 1) return current[0] ?? null;

  // If multiple current, pick the one with the latest start date
  if (current.length > 1) {
    return (
      current.sort((a, b) => (b.startDate?.getTime() ?? 0) - (a.startDate?.getTime() ?? 0))[0] ??
      null
    );
  }

  // All have end dates → pick the most recent one
  return (
    affiliations.sort((a, b) => (b.endDate?.getTime() ?? 0) - (a.endDate?.getTime() ?? 0))[0] ??
    null
  );
}

const handler: SyncHandler = {
  name: "Politic Tracker - MEP National Party Sync",
  description: "Associates French MEPs with their national party via Wikidata P102",

  options: [
    {
      name: "--force",
      type: "boolean",
      description: "Overwrite existing party assignments",
    },
  ],

  showHelp() {
    console.log(`
Politic Tracker - MEP National Party Sync

Requires: Run sync-wikidata-ids first to associate Wikidata IDs to MEPs.
Data source: Wikidata property P102 (member of political party)

This script:
  1. Loads MEPs with a Wikidata ID
  2. Fetches P102 (political party) from Wikidata
  3. Matches the Wikidata party ID to a local party
  4. Sets the MEP's currentPartyId via politicianService

Options:
  --force    Overwrite even if MEP already has a currentPartyId
  --dry-run  Preview changes without saving
  --limit=N  Process only N MEPs
  --stats    Show current MEP party stats
    `);
  },

  async showStats() {
    const [totalMeps, mepsWithParty, mepsWithoutParty, mepsWithWikidata] = await Promise.all([
      db.politician.count({
        where: {
          mandates: { some: { type: MandateType.DEPUTE_EUROPEEN, isCurrent: true } },
        },
      }),
      db.politician.count({
        where: {
          mandates: { some: { type: MandateType.DEPUTE_EUROPEEN, isCurrent: true } },
          currentPartyId: { not: null },
        },
      }),
      db.politician.count({
        where: {
          mandates: { some: { type: MandateType.DEPUTE_EUROPEEN, isCurrent: true } },
          currentPartyId: null,
        },
      }),
      db.externalId.count({
        where: {
          source: DataSource.WIKIDATA,
          politician: {
            mandates: { some: { type: MandateType.DEPUTE_EUROPEEN, isCurrent: true } },
          },
        },
      }),
    ]);

    console.log("\n" + "=".repeat(50));
    console.log("MEP National Party Stats");
    console.log("=".repeat(50));
    console.log(`Total current MEPs:       ${totalMeps}`);
    console.log(
      `With national party:      ${mepsWithParty} (${totalMeps > 0 ? ((mepsWithParty / totalMeps) * 100).toFixed(1) : 0}%)`
    );
    console.log(
      `Without national party:   ${mepsWithoutParty} (${totalMeps > 0 ? ((mepsWithoutParty / totalMeps) * 100).toFixed(1) : 0}%)`
    );
    console.log(
      `With Wikidata ID:         ${mepsWithWikidata} (${totalMeps > 0 ? ((mepsWithWikidata / totalMeps) * 100).toFixed(1) : 0}%)`
    );

    if (mepsWithoutParty > 0 && mepsWithWikidata < totalMeps) {
      console.log(
        `\n⚠ ${totalMeps - mepsWithWikidata} MEPs missing Wikidata ID. Run sync:wikidata-ids first.`
      );
    }
  },

  async sync(options): Promise<SyncResult> {
    const {
      dryRun = false,
      limit,
      force = false,
    } = options as {
      dryRun?: boolean;
      limit?: number;
      force?: boolean;
    };

    const wikidata = new WikidataService({ rateLimitMs: WIKIDATA_SPARQL_RATE_LIMIT_MS });

    const stats = {
      partiesSet: 0,
      alreadyCorrect: 0,
      partyNotInDB: 0,
      noPartyFound: 0,
      skippedHasParty: 0,
    };
    const errors: string[] = [];
    const missingParties = new Map<string, { wikidataId: string; count: number }>();

    // 1. Load current MEPs with Wikidata IDs
    console.log("Fetching current MEPs with Wikidata IDs...");

    const meps = await db.politician.findMany({
      where: {
        mandates: { some: { type: MandateType.DEPUTE_EUROPEEN, isCurrent: true } },
        externalIds: { some: { source: DataSource.WIKIDATA } },
        ...(force ? {} : {}),
      },
      include: {
        externalIds: {
          where: { source: DataSource.WIKIDATA },
          take: 1,
        },
        currentParty: { select: { id: true, shortName: true } },
      },
      take: limit,
    });

    console.log(`Found ${meps.length} MEPs with Wikidata IDs\n`);

    if (meps.length === 0) {
      console.log("No MEPs with Wikidata IDs found. Run sync:wikidata-ids first.");
      return { success: true, duration: 0, stats, errors };
    }

    // 2. Build map: wikidataId → local party ID from ExternalId
    console.log("Building party Wikidata → local ID map...");

    const partyExternalIds = await db.externalId.findMany({
      where: {
        source: DataSource.WIKIDATA,
        partyId: { not: null },
      },
      select: {
        externalId: true,
        partyId: true,
      },
    });

    const wikidataToPartyId = new Map<string, string>();
    for (const ext of partyExternalIds) {
      if (ext.partyId) {
        wikidataToPartyId.set(ext.externalId, ext.partyId);
      }
    }

    console.log(`Found ${wikidataToPartyId.size} parties with Wikidata IDs\n`);

    // 3. Batch-fetch P102 from Wikidata
    const wikidataIds = meps.map((m) => m.externalIds[0]?.externalId).filter(Boolean) as string[];

    console.log(`Fetching P102 (political party) for ${wikidataIds.length} entities...`);
    const partiesMap = await wikidata.getPoliticalParties(wikidataIds);
    console.log(`Fetched party data for ${partiesMap.size} entities\n`);

    // Collect unknown party IDs for label fetching
    const unknownPartyIds = new Set<string>();
    partiesMap.forEach((affiliations) => {
      for (const a of affiliations) {
        if (!wikidataToPartyId.has(a.partyWikidataId)) {
          unknownPartyIds.add(a.partyWikidataId);
        }
      }
    });

    // Fetch labels for unknown parties (for better logging)
    let partyLabels = new Map<string, string>();
    if (unknownPartyIds.size > 0) {
      console.log(`Fetching labels for ${unknownPartyIds.size} unknown parties...`);
      const labelEntities = await wikidata.getEntities(Array.from(unknownPartyIds), ["labels"]);
      labelEntities.forEach((entity, id) => {
        const label = entity.labels.fr || entity.labels.en;
        if (label) partyLabels.set(id, label);
      });
      console.log("");
    }

    // 4. Process each MEP
    const progress = new ProgressTracker({
      total: meps.length,
      label: "Syncing MEP parties",
      showBar: true,
      showETA: true,
      logInterval: 20,
    });

    for (const mep of meps) {
      const wikidataId = mep.externalIds[0]?.externalId;
      if (!wikidataId) {
        progress.tick();
        continue;
      }

      // Skip if already has party and not --force
      if (mep.currentPartyId && !force) {
        stats.skippedHasParty++;
        progress.tick();
        continue;
      }

      const affiliations = partiesMap.get(wikidataId) || [];
      const current = findCurrentAffiliation(affiliations);

      if (!current) {
        stats.noPartyFound++;
        progress.tick();
        continue;
      }

      const localPartyId = wikidataToPartyId.get(current.partyWikidataId);

      if (!localPartyId) {
        stats.partyNotInDB++;
        const partyLabel = partyLabels.get(current.partyWikidataId) || current.partyWikidataId;

        const existing = missingParties.get(current.partyWikidataId);
        if (existing) {
          existing.count++;
        } else {
          missingParties.set(current.partyWikidataId, {
            wikidataId: current.partyWikidataId,
            count: 1,
          });
        }

        if (dryRun) {
          console.log(
            `[DRY-RUN] ${mep.fullName} → party not in DB: ${partyLabel} (${current.partyWikidataId})`
          );
        }
        progress.tick();
        continue;
      }

      // Check if already correct
      if (mep.currentPartyId === localPartyId) {
        stats.alreadyCorrect++;
        progress.tick();
        continue;
      }

      if (dryRun) {
        const partyName = wikidataToPartyId.get(current.partyWikidataId) || current.partyWikidataId;
        console.log(
          `[DRY-RUN] ${mep.fullName} → ${partyName} (was: ${mep.currentParty?.shortName ?? "none"})`
        );
        stats.partiesSet++;
      } else {
        try {
          await politicianService.setCurrentParty(mep.id, localPartyId);
          stats.partiesSet++;
        } catch (error) {
          errors.push(`${mep.fullName}: ${error}`);
        }
      }

      progress.tick();
    }

    progress.finish();

    // Summary
    console.log("\n" + "=".repeat(50));
    console.log("Results");
    console.log("=".repeat(50));
    console.log(`Parties set:          ${stats.partiesSet}`);
    console.log(`Already correct:      ${stats.alreadyCorrect}`);
    console.log(`Skipped (has party):  ${stats.skippedHasParty}`);
    console.log(`No party in Wikidata: ${stats.noPartyFound}`);
    console.log(`Party not in DB:      ${stats.partyNotInDB}`);

    if (missingParties.size > 0) {
      console.log("\n⚠ Parties found in Wikidata but not in local DB:");
      const sorted = Array.from(missingParties.entries()).sort((a, b) => b[1].count - a[1].count);
      for (const [wikidataId, info] of sorted) {
        const label = partyLabels.get(wikidataId) || "?";
        console.log(`  ${label} (${wikidataId}) — ${info.count} MEP(s)`);
      }
      console.log("\n  → Run sync:parties to import missing parties, then re-run this script.");
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
