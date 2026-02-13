/**
 * Import historical party leaders from Wikidata P488 (chairperson)
 *
 * Unlike sync-careers Phase 2 which only imports CURRENT leaders (no end date),
 * this script imports ALL leaders including past ones (with end dates).
 *
 * Safeguards:
 * - Never overwrites mandates with source=MANUAL
 * - Uses externalId to avoid duplicates on re-run
 *
 * Usage:
 *   npm run populate:party-leaders              # Full import
 *   npm run populate:party-leaders -- --dry-run # Preview only
 *   npm run populate:party-leaders -- --stats   # Show stats
 */

import "dotenv/config";
import { createCLI, type SyncHandler, type SyncResult } from "../src/lib/sync";
import { WikidataService } from "../src/lib/api";
import { parseDate } from "../src/lib/parsing";
import { db } from "../src/lib/db";
import { DataSource, MandateType } from "../src/generated/prisma";
import { PARTY_LEADERSHIP_TITLE_SUGGESTIONS } from "../src/config/labels";

function getTitleForParty(partyShortName: string | null, partyName: string): string {
  if (partyShortName && PARTY_LEADERSHIP_TITLE_SUGGESTIONS[partyShortName]) {
    return PARTY_LEADERSHIP_TITLE_SUGGESTIONS[partyShortName];
  }
  return `Dirigeant(e) - ${partyName}`;
}

const handler: SyncHandler = {
  name: "Populate Party Leaders from Wikidata P488",
  description: "Imports historical party leaders (past + current) from Wikidata",

  showHelp() {
    console.log(`
Populate Party Leaders from Wikidata P488

Imports ALL chairperson claims (P488) from Wikidata, including past leaders.
Unlike sync-careers Phase 2, this script also imports leaders with end dates.

Safeguards:
  - Never overwrites mandates with source=MANUAL
  - Uses externalId to avoid duplicates on re-run
    `);
  },

  async showStats() {
    const leadershipMandates = await db.mandate.groupBy({
      by: ["source"],
      where: { type: "PRESIDENT_PARTI" },
      _count: true,
    });

    const total = await db.mandate.count({ where: { type: "PRESIDENT_PARTI" } });
    const current = await db.mandate.count({
      where: { type: "PRESIDENT_PARTI", isCurrent: true },
    });

    console.log("\n" + "=".repeat(50));
    console.log("Party Leadership Stats");
    console.log("=".repeat(50));
    console.log(`Total leadership mandates: ${total}`);
    console.log(`Current leaders: ${current}`);
    console.log("\nBy source:");
    for (const { source, _count } of leadershipMandates) {
      console.log(`  ${source || "null"}: ${_count}`);
    }
  },

  async sync(options): Promise<SyncResult> {
    const { dryRun = false } = options as { dryRun?: boolean };

    const wikidata = new WikidataService({ rateLimitMs: 300 });
    const stats = {
      partiesProcessed: 0,
      mandatesCreated: 0,
      mandatesSkipped: 0,
      manualProtected: 0,
      politicianNotFound: 0,
    };
    const errors: string[] = [];

    // 1. Get all parties with Wikidata IDs
    const partyExternalIds = await db.externalId.findMany({
      where: {
        source: DataSource.WIKIDATA,
        partyId: { not: null },
      },
      include: {
        party: true,
      },
    });

    console.log(`Found ${partyExternalIds.length} parties with Wikidata IDs\n`);

    if (partyExternalIds.length === 0) {
      return { success: true, duration: 0, stats, errors };
    }

    // 2. Fetch entities in batch
    const partyWikidataIds = partyExternalIds.map((e) => e.externalId).filter(Boolean);
    console.log("Fetching P488 claims from Wikidata...");
    const partyEntities = await wikidata.getEntities(partyWikidataIds, ["claims"]);

    // 3. Parse all chairperson claims (current AND past)
    const chairpersonData: Array<{
      partyName: string;
      partyShortName: string | null;
      partyId: string;
      partyWikidataId: string;
      chairpersonWikidataId: string;
      startDate: Date | null;
      endDate: Date | null;
    }> = [];

    const chairpersonIds = new Set<string>();

    for (const ext of partyExternalIds) {
      if (!ext.party) continue;
      stats.partiesProcessed++;

      const entity = partyEntities.get(ext.externalId);
      if (!entity) continue;

      const chairClaims = entity.claims["P488"];
      if (!chairClaims) continue;

      for (const claim of chairClaims) {
        const val = claim.mainsnak?.datavalue?.value;
        if (!val || typeof val !== "object" || !("id" in val)) continue;

        const personQId = val.id as string;

        // Extract start date (P580)
        let startDate: Date | null = null;
        const startQual = claim.qualifiers?.["P580"];
        if (startQual?.[0]?.datavalue?.value) {
          const timeValue = startQual[0].datavalue.value;
          if (typeof timeValue === "object" && "time" in timeValue) {
            const parsed = parseDate((timeValue as { time: string }).time);
            if (parsed) startDate = parsed;
          }
        }

        // Extract end date (P582) — this is the key difference from sync-careers Phase 2
        let endDate: Date | null = null;
        const endQual = claim.qualifiers?.["P582"];
        if (endQual?.[0]?.datavalue?.value) {
          const timeValue = endQual[0].datavalue.value;
          if (typeof timeValue === "object" && "time" in timeValue) {
            const parsed = parseDate((timeValue as { time: string }).time);
            if (parsed) endDate = parsed;
          }
        }

        chairpersonIds.add(personQId);
        chairpersonData.push({
          partyName: ext.party.name,
          partyShortName: ext.party.shortName,
          partyId: ext.party.id,
          partyWikidataId: ext.externalId,
          chairpersonWikidataId: personQId,
          startDate,
          endDate,
        });
      }
    }

    console.log(
      `Found ${chairpersonData.length} chairperson claims across ${stats.partiesProcessed} parties`
    );

    if (chairpersonData.length === 0) {
      return { success: true, duration: 0, stats, errors };
    }

    // 4. Resolve chairperson labels
    console.log(`Resolving labels for ${chairpersonIds.size} unique persons...`);
    const chairLabels = await wikidata.getEntities(Array.from(chairpersonIds), ["labels"]);

    // 5. Process each claim
    for (const data of chairpersonData) {
      const chairLabel =
        chairLabels.get(data.chairpersonWikidataId)?.labels?.fr ||
        chairLabels.get(data.chairpersonWikidataId)?.labels?.en ||
        data.chairpersonWikidataId;

      // Find politician in our DB
      const politicianExt = await db.externalId.findFirst({
        where: {
          source: DataSource.WIKIDATA,
          externalId: data.chairpersonWikidataId,
          politicianId: { not: null },
        },
      });

      if (!politicianExt?.politicianId) {
        if (dryRun) {
          console.log(`[SKIP] ${chairLabel} - ${data.partyName} (politician not in DB)`);
        }
        stats.politicianNotFound++;
        continue;
      }

      // Check if MANUAL entry exists — never overwrite
      const manualExists = await db.mandate.findFirst({
        where: {
          politicianId: politicianExt.politicianId,
          type: MandateType.PRESIDENT_PARTI,
          partyId: data.partyId,
          source: "MANUAL",
        },
      });

      if (manualExists) {
        stats.manualProtected++;
        continue;
      }

      const externalMandateId = `wikidata-p488-${data.partyWikidataId}-${data.chairpersonWikidataId}`;

      // Check if already exists by externalId
      const existingByExtId = await db.mandate.findFirst({
        where: { externalId: externalMandateId },
      });

      if (existingByExtId) {
        stats.mandatesSkipped++;
        continue;
      }

      const title = getTitleForParty(data.partyShortName, data.partyName);
      const isCurrent = !data.endDate;

      if (dryRun) {
        console.log(
          `[DRY-RUN] ${chairLabel} - ${title} @ ${data.partyName} (${data.startDate?.getFullYear() || "?"} - ${data.endDate?.getFullYear() || "en cours"})`
        );
        stats.mandatesCreated++;
      } else {
        try {
          await db.mandate.create({
            data: {
              politicianId: politicianExt.politicianId,
              type: MandateType.PRESIDENT_PARTI,
              title,
              institution: data.partyName,
              partyId: data.partyId,
              source: DataSource.WIKIDATA,
              startDate: data.startDate ?? new Date(),
              endDate: data.endDate,
              isCurrent,
              sourceUrl: `https://www.wikidata.org/wiki/${data.partyWikidataId}`,
              externalId: externalMandateId,
            },
          });
          stats.mandatesCreated++;
        } catch (error) {
          errors.push(`${chairLabel} @ ${data.partyName}: ${error}`);
        }
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log("Results:");
    console.log(`  Parties processed: ${stats.partiesProcessed}`);
    console.log(`  Mandates created: ${stats.mandatesCreated}`);
    console.log(`  Mandates skipped (already exist): ${stats.mandatesSkipped}`);
    console.log(`  Manual entries protected: ${stats.manualProtected}`);
    console.log(`  Politicians not in DB: ${stats.politicianNotFound}`);

    return {
      success: errors.length === 0,
      duration: 0,
      stats,
      errors,
    };
  },
};

createCLI(handler);
