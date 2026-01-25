/**
 * CLI script to enrich politicians with Wikidata IDs
 *
 * Strategy: For each politician in our DB, search Wikidata by name.
 * This is more efficient than fetching all French politicians from Wikidata.
 *
 * Usage:
 *   npx tsx scripts/sync-wikidata-ids.ts              # Sync Wikidata IDs
 *   npx tsx scripts/sync-wikidata-ids.ts --stats      # Show current stats
 *   npx tsx scripts/sync-wikidata-ids.ts --dry-run    # Preview without saving
 *   npx tsx scripts/sync-wikidata-ids.ts --limit=100  # Process only 100 politicians
 */

import "dotenv/config";
import { db } from "../src/lib/db";
import { DataSource } from "../src/generated/prisma";

const WIKIDATA_API = "https://www.wikidata.org/w/api.php";

// Rate limiting
const DELAY_BETWEEN_REQUESTS_MS = 200;

interface WikidataEntity {
  id: string;
  label: string;
  description?: string;
  birthDate?: string;
}

/**
 * Search Wikidata for a person by name using the search API (much faster than SPARQL)
 */
async function searchWikidataByName(fullName: string): Promise<WikidataEntity[]> {
  const url = new URL(WIKIDATA_API);
  url.searchParams.set("action", "wbsearchentities");
  url.searchParams.set("search", fullName);
  url.searchParams.set("language", "fr");
  url.searchParams.set("type", "item");
  url.searchParams.set("limit", "5");
  url.searchParams.set("format", "json");

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": "TransparencePolitique/1.0 (https://politic-tracker.vercel.app)",
    },
  });

  if (!response.ok) {
    throw new Error(`Wikidata search failed: ${response.status}`);
  }

  const data = await response.json();

  if (!data.search || data.search.length === 0) {
    return [];
  }

  // Get entity IDs
  const ids = data.search.map((s: { id: string }) => s.id);

  // Fetch entity details to get birth date
  return fetchEntityDetails(ids);
}

/**
 * Fetch entity details (birth date, nationality) to verify it's a French politician
 */
async function fetchEntityDetails(ids: string[]): Promise<WikidataEntity[]> {
  const url = new URL(WIKIDATA_API);
  url.searchParams.set("action", "wbgetentities");
  url.searchParams.set("ids", ids.join("|"));
  url.searchParams.set("props", "labels|claims");
  url.searchParams.set("languages", "fr|en");
  url.searchParams.set("format", "json");

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": "TransparencePolitique/1.0 (https://politic-tracker.vercel.app)",
    },
  });

  if (!response.ok) {
    throw new Error(`Wikidata entities failed: ${response.status}`);
  }

  const data = await response.json();
  const results: WikidataEntity[] = [];

  for (const id of ids) {
    const entity = data.entities?.[id];
    if (!entity) continue;

    // Check if French (P27 = Q142)
    const nationalities = entity.claims?.P27 || [];
    const isFrench = nationalities.some(
      (n: { mainsnak?: { datavalue?: { value?: { id?: string } } } }) =>
        n.mainsnak?.datavalue?.value?.id === "Q142"
    );

    if (!isFrench) continue;

    // Check if human (P31 = Q5)
    const instanceOf = entity.claims?.P31 || [];
    const isHuman = instanceOf.some(
      (i: { mainsnak?: { datavalue?: { value?: { id?: string } } } }) =>
        i.mainsnak?.datavalue?.value?.id === "Q5"
    );

    if (!isHuman) continue;

    // Get birth date (P569)
    let birthDate: string | undefined;
    const birthClaims = entity.claims?.P569 || [];
    if (birthClaims.length > 0) {
      const timeValue = birthClaims[0]?.mainsnak?.datavalue?.value?.time;
      if (timeValue) {
        // Format: "+1977-12-21T00:00:00Z" -> "1977-12-21"
        birthDate = timeValue.replace(/^\+/, "").split("T")[0];
      }
    }

    // Get label
    const label = entity.labels?.fr?.value || entity.labels?.en?.value || id;

    results.push({
      id,
      label,
      birthDate,
    });
  }

  return results;
}

/**
 * Extract Wikidata Q-ID from URI
 */
function extractQId(uri: string): string {
  return uri.split("/").pop() || "";
}

/**
 * Normalize name for comparison
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z\s-]/g, "") // Keep letters, spaces, hyphens
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse date from Wikidata
 */
function parseDate(dateStr?: string): Date | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

/**
 * Check if two dates match (within tolerance)
 */
function datesMatch(date1: Date | null, date2: Date | null, toleranceDays = 5): boolean {
  if (!date1 || !date2) return true; // If one is missing, don't disqualify
  const diff = Math.abs(date1.getTime() - date2.getTime());
  const daysDiff = diff / (1000 * 60 * 60 * 24);
  return daysDiff <= toleranceDays;
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface SyncResult {
  politiciansProcessed: number;
  idsCreated: number;
  alreadyHadId: number;
  noMatch: number;
  multipleMatches: number;
  errors: string[];
}

/**
 * Main sync function
 */
async function syncWikidataIds(options: {
  dryRun?: boolean;
  limit?: number;
} = {}): Promise<SyncResult> {
  const { dryRun = false, limit } = options;

  const result: SyncResult = {
    politiciansProcessed: 0,
    idsCreated: 0,
    alreadyHadId: 0,
    noMatch: 0,
    multipleMatches: 0,
    errors: [],
  };

  // Get politicians without Wikidata ID
  console.log("Fetching politicians from database...");

  const politicians = await db.politician.findMany({
    where: {
      externalIds: {
        none: { source: DataSource.WIKIDATA },
      },
    },
    select: {
      id: true,
      fullName: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      deathDate: true,
    },
    take: limit,
    orderBy: { lastName: "asc" },
  });

  console.log(`Found ${politicians.length} politicians without Wikidata ID\n`);

  // Process one by one with rate limiting
  for (let i = 0; i < politicians.length; i++) {
    const politician = politicians[i];
    result.politiciansProcessed++;

    try {
      // Search Wikidata by full name
      const candidates = await searchWikidataByName(politician.fullName);

      if (candidates.length === 0) {
        result.noMatch++;
        continue;
      }

      // Find best match
      let bestMatch: WikidataEntity | null = null;

      if (candidates.length === 1) {
        bestMatch = candidates[0];
      } else {
        // Multiple candidates - match by birth date
        for (const candidate of candidates) {
          if (candidate.birthDate && politician.birthDate) {
            const wdDate = parseDate(candidate.birthDate);
            if (datesMatch(politician.birthDate, wdDate)) {
              bestMatch = candidate;
              break;
            }
          }
        }

        if (!bestMatch) {
          result.multipleMatches++;
          continue;
        }
      }

      const wikidataId = bestMatch.id;

      if (dryRun) {
        console.log(`[DRY-RUN] ${politician.fullName} -> ${wikidataId}`);
        result.idsCreated++;
      } else {
        // Check if this Wikidata ID is already used
        const existing = await db.externalId.findUnique({
          where: {
            source_externalId: {
              source: DataSource.WIKIDATA,
              externalId: wikidataId,
            },
          },
        });

        if (existing) {
          result.alreadyHadId++;
          continue;
        }

        await db.externalId.create({
          data: {
            politicianId: politician.id,
            source: DataSource.WIKIDATA,
            externalId: wikidataId,
            url: `https://www.wikidata.org/wiki/${wikidataId}`,
          },
        });
        result.idsCreated++;
        console.log(`✓ ${politician.fullName} -> ${wikidataId}`);
      }
    } catch (error) {
      result.errors.push(`${politician.fullName}: ${error}`);
    }

    // Progress every 50
    if ((i + 1) % 50 === 0) {
      const progress = (((i + 1) / politicians.length) * 100).toFixed(0);
      console.log(`\n--- Progress: ${progress}% (${i + 1}/${politicians.length}) | Created: ${result.idsCreated} ---\n`);
    }

    // Rate limiting
    await sleep(DELAY_BETWEEN_REQUESTS_MS);
  }

  return result;
}

/**
 * Show current stats
 */
async function showStats(): Promise<void> {
  const [totalPoliticians, withWikidata, withoutWikidata] = await Promise.all([
    db.politician.count(),
    db.externalId.count({
      where: {
        source: DataSource.WIKIDATA,
        politicianId: { not: null },
      },
    }),
    db.politician.count({
      where: {
        externalIds: {
          none: { source: DataSource.WIKIDATA },
        },
      },
    }),
  ]);

  console.log("\n" + "=".repeat(50));
  console.log("Wikidata ID Stats");
  console.log("=".repeat(50));
  console.log(`Total politicians: ${totalPoliticians}`);
  console.log(`With Wikidata ID: ${withWikidata} (${((withWikidata / totalPoliticians) * 100).toFixed(1)}%)`);
  console.log(`Without Wikidata ID: ${withoutWikidata}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Politic Tracker - Wikidata ID Sync

Usage:
  npx tsx scripts/sync-wikidata-ids.ts              Sync Wikidata IDs for all politicians
  npx tsx scripts/sync-wikidata-ids.ts --dry-run    Preview without saving
  npx tsx scripts/sync-wikidata-ids.ts --limit=100  Process only first 100 politicians
  npx tsx scripts/sync-wikidata-ids.ts --stats      Show current stats
  npx tsx scripts/sync-wikidata-ids.ts --help       Show this help

Strategy: For each politician in our DB, search Wikidata by name and match
by birth date when there are multiple candidates.
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
  console.log("Politic Tracker - Wikidata ID Sync");
  console.log("=".repeat(50));
  console.log(`Mode: ${dryRun ? "DRY RUN (no changes)" : "LIVE"}`);
  if (limit) console.log(`Limit: ${limit} politicians`);
  console.log(`Started at: ${new Date().toISOString()}\n`);

  const startTime = Date.now();
  const result = await syncWikidataIds({ dryRun, limit });
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("\n" + "=".repeat(50));
  console.log("Sync Results:");
  console.log("=".repeat(50));
  console.log(`Duration: ${duration}s`);
  console.log(`Politicians processed: ${result.politiciansProcessed}`);
  console.log(`Wikidata IDs created: ${result.idsCreated}`);
  console.log(`ID already used by another: ${result.alreadyHadId}`);
  console.log(`No match found: ${result.noMatch}`);
  console.log(`Multiple matches (skipped): ${result.multipleMatches}`);

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
