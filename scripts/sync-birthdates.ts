/**
 * CLI script to enrich politicians with birth dates from Wikidata
 *
 * Fetches birth dates (P569) for politicians who have a Wikidata ID but no birth date.
 *
 * Usage:
 *   npm run sync:birthdates              # Sync birth dates
 *   npm run sync:birthdates -- --stats   # Show current stats
 *   npm run sync:birthdates -- --dry-run # Preview without saving
 *   npm run sync:birthdates -- --limit=100 # Process only 100 politicians
 */

import "dotenv/config";
import { db } from "../src/lib/db";
import { DataSource } from "../src/generated/prisma";

const WIKIDATA_API = "https://www.wikidata.org/w/api.php";

// Rate limiting
const DELAY_BETWEEN_REQUESTS_MS = 100;
const BATCH_SIZE = 50; // Wikidata API supports up to 50 entities per request

interface WikidataBirthDate {
  wikidataId: string;
  birthDate: Date | null;
  deathDate: Date | null;
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
      if (timeValue) {
        // Format: "+1977-12-21T00:00:00Z" -> Date
        const dateStr = timeValue.replace(/^\+/, "").split("T")[0];
        birthDate = parseDate(dateStr);
      }
    }

    // Get death date (P570) - useful to have
    let deathDate: Date | null = null;
    const deathClaims = entity.claims?.P570 || [];
    if (deathClaims.length > 0) {
      const timeValue = deathClaims[0]?.mainsnak?.datavalue?.value?.time;
      if (timeValue) {
        const dateStr = timeValue.replace(/^\+/, "").split("T")[0];
        deathDate = parseDate(dateStr);
      }
    }

    results.push({ wikidataId, birthDate, deathDate });
  }

  return results;
}

/**
 * Parse date string to Date object
 */
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  try {
    // Handle partial dates like "1977-00-00" -> use January 1st
    const parts = dateStr.split("-");
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) || 1;
    const day = parseInt(parts[2], 10) || 1;

    if (isNaN(year) || year < 1800 || year > 2100) return null;

    const date = new Date(year, month - 1, day);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface SyncResult {
  politiciansProcessed: number;
  birthDatesAdded: number;
  deathDatesAdded: number;
  alreadyHadDate: number;
  noDateInWikidata: number;
  errors: string[];
}

/**
 * Main sync function
 */
async function syncBirthDates(options: {
  dryRun?: boolean;
  limit?: number;
} = {}): Promise<SyncResult> {
  const { dryRun = false, limit } = options;

  const result: SyncResult = {
    politiciansProcessed: 0,
    birthDatesAdded: 0,
    deathDatesAdded: 0,
    alreadyHadDate: 0,
    noDateInWikidata: 0,
    errors: [],
  };

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
    take: limit,
    orderBy: { lastName: "asc" },
  });

  console.log(`Found ${politicians.length} politicians with Wikidata ID but no birth date\n`);

  if (politicians.length === 0) {
    return result;
  }

  // Process in batches
  const batches: typeof politicians[] = [];
  for (let i = 0; i < politicians.length; i += BATCH_SIZE) {
    batches.push(politicians.slice(i, i + BATCH_SIZE));
  }

  console.log(`Processing in ${batches.length} batches of up to ${BATCH_SIZE}...\n`);

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];

    try {
      // Build map of Wikidata ID -> politician
      const wikidataIdMap = new Map<string, typeof politicians[0]>();
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

        result.politiciansProcessed++;

        if (!birthDate) {
          result.noDateInWikidata++;
          continue;
        }

        if (dryRun) {
          console.log(`[DRY-RUN] ${politician.fullName} -> ${birthDate.toISOString().split("T")[0]}`);
          result.birthDatesAdded++;
          if (deathDate && !politician.deathDate) {
            result.deathDatesAdded++;
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

          console.log(`✓ ${politician.fullName} -> ${birthDate.toISOString().split("T")[0]}${deathDate && !politician.deathDate ? ` (†${deathDate.toISOString().split("T")[0]})` : ""}`);
          result.birthDatesAdded++;
          if (deathDate && !politician.deathDate) {
            result.deathDatesAdded++;
          }
        }
      }
    } catch (error) {
      result.errors.push(`Batch ${batchIndex + 1}: ${error}`);
    }

    // Progress
    const progress = (((batchIndex + 1) / batches.length) * 100).toFixed(0);
    if ((batchIndex + 1) % 5 === 0 || batchIndex === batches.length - 1) {
      console.log(`\n--- Progress: ${progress}% (${(batchIndex + 1) * BATCH_SIZE}/${politicians.length}) | Added: ${result.birthDatesAdded} ---\n`);
    }

    // Rate limiting between batches
    await sleep(DELAY_BETWEEN_REQUESTS_MS);
  }

  return result;
}

/**
 * Show current stats
 */
async function showStats(): Promise<void> {
  const [
    totalPoliticians,
    withBirthDate,
    withoutBirthDate,
    withWikidataNoDate,
  ] = await Promise.all([
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
  console.log(`With birth date: ${withBirthDate} (${((withBirthDate / totalPoliticians) * 100).toFixed(1)}%)`);
  console.log(`Without birth date: ${withoutBirthDate}`);
  console.log(`  - With Wikidata ID (enrichable): ${withWikidataNoDate}`);
  console.log(`  - Without Wikidata ID: ${withoutBirthDate - withWikidataNoDate}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Politic Tracker - Birth Date Sync

Usage:
  npm run sync:birthdates              Sync birth dates for all politicians with Wikidata ID
  npm run sync:birthdates -- --dry-run Preview without saving
  npm run sync:birthdates -- --limit=100 Process only first 100 politicians
  npm run sync:birthdates -- --stats   Show current stats
  npm run sync:birthdates -- --help    Show this help

This script fetches birth dates (P569) and death dates (P570) from Wikidata
for politicians who have a Wikidata ID but no birth date in our database.
    `);
    process.exit(0);
  }

  if (args.includes("--stats")) {
    await showStats();
    process.exit(0);
  }

  const dryRun = args.includes("--dry-run");
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : undefined;

  console.log("=".repeat(50));
  console.log("Politic Tracker - Birth Date Sync");
  console.log("=".repeat(50));
  console.log(`Mode: ${dryRun ? "DRY RUN (no changes)" : "LIVE"}`);
  if (limit) console.log(`Limit: ${limit} politicians`);
  console.log(`Started at: ${new Date().toISOString()}\n`);

  const startTime = Date.now();
  const result = await syncBirthDates({ dryRun, limit });
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("\n" + "=".repeat(50));
  console.log("Sync Results:");
  console.log("=".repeat(50));
  console.log(`Duration: ${duration}s`);
  console.log(`Politicians processed: ${result.politiciansProcessed}`);
  console.log(`Birth dates added: ${result.birthDatesAdded}`);
  console.log(`Death dates added: ${result.deathDatesAdded}`);
  console.log(`No date in Wikidata: ${result.noDateInWikidata}`);

  if (result.errors.length > 0) {
    console.log(`\nErrors (${result.errors.length}):`);
    result.errors.slice(0, 10).forEach((e) => console.log(`  - ${e}`));
    if (result.errors.length > 10) {
      console.log(`  ... and ${result.errors.length - 10} more`);
    }
  }

  console.log("\n" + "=".repeat(50));
}

main()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    process.exit(0);
  });
