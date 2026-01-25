/**
 * CLI script to enrich politicians with Wikidata IDs
 *
 * Matches existing politicians by name to Wikidata entities and stores the IDs.
 * This enables career enrichment via sync-careers.ts
 *
 * Usage:
 *   npx tsx scripts/sync-wikidata-ids.ts              # Sync Wikidata IDs for all politicians
 *   npx tsx scripts/sync-wikidata-ids.ts --stats      # Show current stats
 *   npx tsx scripts/sync-wikidata-ids.ts --dry-run    # Preview without saving
 */

import "dotenv/config";
import { db } from "../src/lib/db";
import { DataSource } from "../src/generated/prisma";

const WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql";

interface WikidataPoliticianResult {
  person: { value: string };
  personLabel: { value: string };
  birthDate?: { value: string };
  deathDate?: { value: string };
}

/**
 * Fetch French politicians from Wikidata
 */
async function fetchAllFrenchPoliticians(): Promise<WikidataPoliticianResult[]> {
  const query = `
    SELECT DISTINCT ?person ?personLabel ?birthDate ?deathDate WHERE {
      ?person wdt:P27 wd:Q142 .           # French citizen
      ?person wdt:P106 wd:Q82955 .        # occupation: politician

      OPTIONAL { ?person wdt:P569 ?birthDate }
      OPTIONAL { ?person wdt:P570 ?deathDate }

      # Filter to Ve République era (born after 1900 or died after 1958)
      OPTIONAL { ?person wdt:P569 ?bd }
      OPTIONAL { ?person wdt:P570 ?dd }
      FILTER (
        (!BOUND(?dd) || YEAR(?dd) >= 1958) &&
        (!BOUND(?bd) || YEAR(?bd) >= 1900)
      )

      SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en" }
    }
    ORDER BY ?personLabel
  `;

  const url = new URL(WIKIDATA_ENDPOINT);
  url.searchParams.set("query", query);

  console.log("Fetching French politicians from Wikidata...");
  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "TransparencePolitique/1.0 (https://politic-tracker.vercel.app)",
    },
  });

  if (!response.ok) {
    throw new Error(`Wikidata query failed: ${response.status}`);
  }

  const data = await response.json();
  console.log(`Found ${data.results.bindings.length} French politicians in Wikidata`);
  return data.results.bindings;
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
    .replace(/[^a-z\s]/g, "") // Remove non-letters
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
 * Check if two dates are within N days of each other
 */
function datesMatch(date1: Date | null, date2: Date | null, toleranceDays = 5): boolean {
  if (!date1 || !date2) return true; // If one is missing, don't disqualify
  const diff = Math.abs(date1.getTime() - date2.getTime());
  const daysDiff = diff / (1000 * 60 * 60 * 24);
  return daysDiff <= toleranceDays;
}

interface SyncResult {
  politiciansProcessed: number;
  idsCreated: number;
  idsSkipped: number;
  noMatch: number;
  errors: string[];
}

/**
 * Main sync function
 */
async function syncWikidataIds(options: { dryRun?: boolean } = {}): Promise<SyncResult> {
  const { dryRun = false } = options;

  const result: SyncResult = {
    politiciansProcessed: 0,
    idsCreated: 0,
    idsSkipped: 0,
    noMatch: 0,
    errors: [],
  };

  // 1. Fetch all French politicians from Wikidata
  const wikidataPoliticians = await fetchAllFrenchPoliticians();

  // 2. Build a lookup map by normalized name
  const wikidataByName = new Map<string, WikidataPoliticianResult[]>();
  for (const wp of wikidataPoliticians) {
    const name = wp.personLabel.value;
    // Skip unresolved Q-numbers
    if (/^Q\d+$/.test(name)) continue;

    const normalized = normalizeName(name);
    if (!wikidataByName.has(normalized)) {
      wikidataByName.set(normalized, []);
    }
    wikidataByName.get(normalized)!.push(wp);
  }

  console.log(`Built lookup map with ${wikidataByName.size} unique names`);

  // 3. Get all politicians from our database
  const politicians = await db.politician.findMany({
    select: {
      id: true,
      fullName: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      deathDate: true,
      externalIds: {
        where: { source: DataSource.WIKIDATA },
        select: { externalId: true },
      },
    },
  });

  console.log(`Processing ${politicians.length} politicians from database...`);

  // 4. Match politicians
  for (const politician of politicians) {
    result.politiciansProcessed++;

    // Skip if already has Wikidata ID
    if (politician.externalIds.length > 0) {
      result.idsSkipped++;
      continue;
    }

    // Try to find match in Wikidata
    const normalizedName = normalizeName(politician.fullName);
    const candidates = wikidataByName.get(normalizedName) || [];

    // Also try with lastName + firstName format
    const altName = normalizeName(`${politician.lastName} ${politician.firstName}`);
    const altCandidates = wikidataByName.get(altName) || [];

    const allCandidates = [...candidates, ...altCandidates];

    if (allCandidates.length === 0) {
      result.noMatch++;
      continue;
    }

    // Find best match by birth date
    let bestMatch: WikidataPoliticianResult | null = null;

    for (const candidate of allCandidates) {
      const wdBirthDate = parseDate(candidate.birthDate?.value);
      const wdDeathDate = parseDate(candidate.deathDate?.value);

      // Check birth date match
      if (politician.birthDate && wdBirthDate) {
        if (datesMatch(politician.birthDate, wdBirthDate)) {
          bestMatch = candidate;
          break;
        }
      } else if (politician.deathDate && wdDeathDate) {
        // Check death date if no birth date
        if (datesMatch(politician.deathDate, wdDeathDate)) {
          bestMatch = candidate;
          break;
        }
      } else {
        // No dates to compare, take first match if only one candidate
        if (allCandidates.length === 1) {
          bestMatch = candidate;
        }
      }
    }

    if (!bestMatch) {
      // If multiple candidates and no date match, skip to avoid wrong matches
      if (allCandidates.length > 1) {
        result.noMatch++;
        continue;
      }
      bestMatch = allCandidates[0];
    }

    const wikidataId = extractQId(bestMatch.person.value);

    if (dryRun) {
      console.log(`[DRY-RUN] ${politician.fullName} -> ${wikidataId}`);
      result.idsCreated++;
    } else {
      try {
        // Check if this Wikidata ID is already used by another politician
        const existing = await db.externalId.findUnique({
          where: {
            source_externalId: {
              source: DataSource.WIKIDATA,
              externalId: wikidataId,
            },
          },
        });

        if (existing) {
          // ID already used, skip
          result.idsSkipped++;
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

        if (result.idsCreated % 100 === 0) {
          console.log(`  Progress: ${result.idsCreated} IDs created...`);
        }
      } catch (error) {
        result.errors.push(`${politician.fullName}: ${error}`);
      }
    }
  }

  return result;
}

/**
 * Show current stats
 */
async function showStats(): Promise<void> {
  const [totalPoliticians, withWikidata] = await Promise.all([
    db.politician.count(),
    db.externalId.count({
      where: {
        source: DataSource.WIKIDATA,
        politicianId: { not: null },
      },
    }),
  ]);

  console.log("\n" + "=".repeat(50));
  console.log("Wikidata ID Stats");
  console.log("=".repeat(50));
  console.log(`Total politicians: ${totalPoliticians}`);
  console.log(`With Wikidata ID: ${withWikidata} (${((withWikidata / totalPoliticians) * 100).toFixed(1)}%)`);
  console.log(`Without Wikidata ID: ${totalPoliticians - withWikidata}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Politic Tracker - Wikidata ID Sync

Usage:
  npx tsx scripts/sync-wikidata-ids.ts              Sync Wikidata IDs for all politicians
  npx tsx scripts/sync-wikidata-ids.ts --dry-run    Preview without saving
  npx tsx scripts/sync-wikidata-ids.ts --stats      Show current stats
  npx tsx scripts/sync-wikidata-ids.ts --help       Show this help

This script matches politicians by name to Wikidata entities and stores
the Wikidata IDs. This enables career enrichment via sync-careers.ts.
    `);
    process.exit(0);
  }

  if (args.includes("--stats")) {
    await showStats();
    process.exit(0);
  }

  const dryRun = args.includes("--dry-run");

  console.log("=".repeat(50));
  console.log("Politic Tracker - Wikidata ID Sync");
  console.log("=".repeat(50));
  console.log(`Mode: ${dryRun ? "DRY RUN (no changes)" : "LIVE"}`);
  console.log(`Started at: ${new Date().toISOString()}\n`);

  const startTime = Date.now();
  const result = await syncWikidataIds({ dryRun });
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("\n" + "=".repeat(50));
  console.log("Sync Results:");
  console.log("=".repeat(50));
  console.log(`Duration: ${duration}s`);
  console.log(`Politicians processed: ${result.politiciansProcessed}`);
  console.log(`Wikidata IDs created: ${result.idsCreated}`);
  console.log(`Already had ID (skipped): ${result.idsSkipped}`);
  console.log(`No match found: ${result.noMatch}`);

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
