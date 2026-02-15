/**
 * CLI script to enrich politicians with birth dates from Wikidata
 *
 * Usage:
 *   npm run sync:birthdates              # Sync birth dates
 *   npm run sync:birthdates -- --stats   # Show current stats
 *   npm run sync:birthdates -- --dry-run # Preview without saving
 *   npm run sync:birthdates -- --limit=100 # Process only 100 politicians
 */

import "dotenv/config";
import { createCLI, ProgressTracker, type SyncHandler, type SyncResult } from "../src/lib/sync";
import { WikidataService } from "../src/lib/api";
import { db } from "../src/lib/db";
import { DataSource } from "../src/generated/prisma";
import { WIKIDATA_RATE_LIMIT_MS } from "../src/config/rate-limits";

const handler: SyncHandler = {
  name: "Politic Tracker - Birth Date Sync",
  description: "Enrichit les dates de naissance depuis Wikidata",

  showHelp() {
    console.log(`
Politic Tracker - Birth Date Sync

Fetches birth dates (P569) and death dates (P570) from Wikidata
for politicians who have a Wikidata ID but no birth date in our database.
    `);
  },

  async showStats() {
    const [totalPoliticians, withBirthDate, withoutBirthDate, withWikidataNoDate] =
      await Promise.all([
        db.politician.count(),
        db.politician.count({ where: { birthDate: { not: null } } }),
        db.politician.count({ where: { birthDate: null } }),
        db.politician.count({
          where: {
            birthDate: null,
            externalIds: { some: { source: DataSource.WIKIDATA } },
          },
        }),
      ]);

    console.log("\n" + "=".repeat(50));
    console.log("Birth Date Stats");
    console.log("=".repeat(50));
    console.log(`Total politicians: ${totalPoliticians}`);
    console.log(
      `With birth date: ${withBirthDate} (${((withBirthDate / totalPoliticians) * 100).toFixed(1)}%)`
    );
    console.log(`Without birth date: ${withoutBirthDate}`);
    console.log(`  - With Wikidata ID (enrichable): ${withWikidataNoDate}`);
    console.log(`  - Without Wikidata ID: ${withoutBirthDate - withWikidataNoDate}`);
  },

  async sync(options): Promise<SyncResult> {
    const { dryRun = false, limit } = options;
    const wikidata = new WikidataService({ rateLimitMs: WIKIDATA_RATE_LIMIT_MS });

    const stats = {
      processed: 0,
      birthDatesAdded: 0,
      deathDatesAdded: 0,
      noDateInWikidata: 0,
    };
    const errors: string[] = [];

    // Get politicians with Wikidata ID but no birth date
    console.log("Fetching politicians from database...");

    const politicians = await db.politician.findMany({
      where: {
        birthDate: null,
        externalIds: {
          some: { source: DataSource.WIKIDATA },
        },
      },
      select: {
        id: true,
        fullName: true,
        deathDate: true,
        externalIds: {
          where: { source: DataSource.WIKIDATA },
          select: { externalId: true },
        },
      },
      take: limit as number | undefined,
      orderBy: { lastName: "asc" },
    });

    console.log(`Found ${politicians.length} politicians to process\n`);

    if (politicians.length === 0) {
      return { success: true, duration: 0, stats, errors };
    }

    // Build map of Wikidata ID -> politician
    const wikidataIdMap = new Map<string, (typeof politicians)[0]>();
    const wikidataIds: string[] = [];

    for (const politician of politicians) {
      const wikidataId = politician.externalIds[0]?.externalId;
      if (wikidataId) {
        wikidataIdMap.set(wikidataId, politician);
        wikidataIds.push(wikidataId);
      }
    }

    // Fetch life dates using the unified service (handles batching internally)
    const progress = new ProgressTracker({
      total: wikidataIds.length,
      label: "Fetching dates",
      showBar: true,
      showETA: true,
    });

    const lifeDates = await wikidata.getLifeDates(wikidataIds);
    progress.finish();

    console.log("\nUpdating database...\n");

    // Update politicians
    for (const [wikidataId, dates] of Array.from(lifeDates.entries())) {
      const politician = wikidataIdMap.get(wikidataId);
      if (!politician) continue;

      stats.processed++;

      if (!dates.birthDate) {
        stats.noDateInWikidata++;
        continue;
      }

      if (dryRun) {
        const birthStr = dates.birthDate.toISOString().split("T")[0];
        const deathStr =
          dates.deathDate && !politician.deathDate
            ? ` (†${dates.deathDate.toISOString().split("T")[0]})`
            : "";
        console.log(`[DRY-RUN] ${politician.fullName} -> ${birthStr}${deathStr}`);
        stats.birthDatesAdded++;
        if (dates.deathDate && !politician.deathDate) {
          stats.deathDatesAdded++;
        }
      } else {
        try {
          const updateData: { birthDate: Date; deathDate?: Date } = {
            birthDate: dates.birthDate,
          };
          if (dates.deathDate && !politician.deathDate) {
            updateData.deathDate = dates.deathDate;
          }

          await db.politician.update({
            where: { id: politician.id },
            data: updateData,
          });

          const birthStr = dates.birthDate.toISOString().split("T")[0];
          const deathStr =
            dates.deathDate && !politician.deathDate
              ? ` (†${dates.deathDate.toISOString().split("T")[0]})`
              : "";
          console.log(`✓ ${politician.fullName} -> ${birthStr}${deathStr}`);

          stats.birthDatesAdded++;
          if (dates.deathDate && !politician.deathDate) {
            stats.deathDatesAdded++;
          }
        } catch (error) {
          errors.push(`${politician.fullName}: ${error}`);
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
