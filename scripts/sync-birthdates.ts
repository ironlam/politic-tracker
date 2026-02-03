/**
 * CLI script to enrich politicians with birth dates from Wikidata
 *
 * Fetches birth dates (P569) and death dates (P570) for politicians
 * who have a Wikidata ID but no birth date.
 *
 * Usage:
 *   npm run sync:birthdates              # Sync birth dates
 *   npm run sync:birthdates -- --stats   # Show current stats
 *   npm run sync:birthdates -- --dry-run # Preview without saving
 *   npm run sync:birthdates -- --limit=100 # Process only 100 politicians
 */

import "dotenv/config";
import { createCLI, type SyncHandler, type SyncResult } from "../src/lib/sync";
import { parseWikidataDate } from "../src/lib/parsing";
import { db } from "../src/lib/db";
import { DataSource } from "../src/generated/prisma";

const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const DELAY_BETWEEN_REQUESTS_MS = 100;
const BATCH_SIZE = 50; // Wikidata API supports up to 50 entities per request

interface WikidataBirthDate {
  wikidataId: string;
  birthDate: Date | null;
  deathDate: Date | null;
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch birth dates for multiple Wikidata entities in a single request
 */
async function fetchBirthDates(wikidataIds: string[]): Promise<WikidataBirthDate[]> {
  const url = new URL(WIKIDATA_API);
  url.searchParams.set("action", "wbgetentities");
  url.searchParams.set("ids", wikidataIds.join("|"));
  url.searchParams.set("props", "claims");
  url.searchParams.set("format", "json");

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": "TransparencePolitique/1.0 (https://politic-tracker.vercel.app)",
    },
  });

  if (!response.ok) {
    throw new Error(`Wikidata API failed: ${response.status}`);
  }

  const data = await response.json();
  const results: WikidataBirthDate[] = [];

  for (const wikidataId of wikidataIds) {
    const entity = data.entities?.[wikidataId];
    if (!entity) {
      results.push({ wikidataId, birthDate: null, deathDate: null });
      continue;
    }

    // Get birth date (P569)
    let birthDate: Date | null = null;
    const birthClaims = entity.claims?.P569 || [];
    if (birthClaims.length > 0) {
      const timeValue = birthClaims[0]?.mainsnak?.datavalue?.value?.time;
      birthDate = parseWikidataDate(timeValue);
    }

    // Get death date (P570)
    let deathDate: Date | null = null;
    const deathClaims = entity.claims?.P570 || [];
    if (deathClaims.length > 0) {
      const timeValue = deathClaims[0]?.mainsnak?.datavalue?.value?.time;
      deathDate = parseWikidataDate(timeValue);
    }

    results.push({ wikidataId, birthDate, deathDate });
  }

  return results;
}

/**
 * Sync handler implementation
 */
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

    const stats = {
      politiciansProcessed: 0,
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
        birthDate: true,
        deathDate: true,
        externalIds: {
          where: { source: DataSource.WIKIDATA },
          select: { externalId: true },
        },
      },
      take: limit as number | undefined,
      orderBy: { lastName: "asc" },
    });

    console.log(`Found ${politicians.length} politicians with Wikidata ID but no birth date\n`);

    if (politicians.length === 0) {
      return { success: true, duration: 0, stats, errors };
    }

    // Process in batches
    const batches: (typeof politicians)[] = [];
    for (let i = 0; i < politicians.length; i += BATCH_SIZE) {
      batches.push(politicians.slice(i, i + BATCH_SIZE));
    }

    console.log(`Processing in ${batches.length} batches of up to ${BATCH_SIZE}...\n`);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];

      try {
        // Build map of Wikidata ID -> politician
        const wikidataIdMap = new Map<string, (typeof politicians)[0]>();
        for (const politician of batch) {
          const wikidataId = politician.externalIds[0]?.externalId;
          if (wikidataId) {
            wikidataIdMap.set(wikidataId, politician);
          }
        }

        const wikidataIds = Array.from(wikidataIdMap.keys());

        // Fetch birth dates from Wikidata
        const birthDates = await fetchBirthDates(wikidataIds);

        // Update politicians
        for (const { wikidataId, birthDate, deathDate } of birthDates) {
          const politician = wikidataIdMap.get(wikidataId);
          if (!politician) continue;

          stats.politiciansProcessed++;

          if (!birthDate) {
            stats.noDateInWikidata++;
            continue;
          }

          if (dryRun) {
            console.log(
              `[DRY-RUN] ${politician.fullName} -> ${birthDate.toISOString().split("T")[0]}`
            );
            stats.birthDatesAdded++;
            if (deathDate && !politician.deathDate) {
              stats.deathDatesAdded++;
            }
          } else {
            // Update politician with birth date (and death date if available)
            const updateData: { birthDate: Date; deathDate?: Date } = { birthDate };
            if (deathDate && !politician.deathDate) {
              updateData.deathDate = deathDate;
            }

            await db.politician.update({
              where: { id: politician.id },
              data: updateData,
            });

            console.log(
              `✓ ${politician.fullName} -> ${birthDate.toISOString().split("T")[0]}${deathDate && !politician.deathDate ? ` (†${deathDate.toISOString().split("T")[0]})` : ""}`
            );
            stats.birthDatesAdded++;
            if (deathDate && !politician.deathDate) {
              stats.deathDatesAdded++;
            }
          }
        }
      } catch (error) {
        errors.push(`Batch ${batchIndex + 1}: ${error}`);
      }

      // Progress
      const progress = (((batchIndex + 1) / batches.length) * 100).toFixed(0);
      if ((batchIndex + 1) % 5 === 0 || batchIndex === batches.length - 1) {
        console.log(
          `\n--- Progress: ${progress}% (${(batchIndex + 1) * BATCH_SIZE}/${politicians.length}) | Added: ${stats.birthDatesAdded} ---\n`
        );
      }

      // Rate limiting between batches
      await sleep(DELAY_BETWEEN_REQUESTS_MS);
    }

    return {
      success: errors.length === 0,
      duration: 0, // Calculated by CLI runner
      stats,
      errors,
    };
  },
};

createCLI(handler);
