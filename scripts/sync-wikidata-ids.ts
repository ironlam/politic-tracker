/**
 * CLI script to enrich politicians with Wikidata IDs
 *
 * Strategy: For each politician in our DB, search Wikidata by name.
 * This is more efficient than fetching all French politicians from Wikidata.
 *
 * Usage:
 *   npm run sync:wikidata-ids              # Sync Wikidata IDs
 *   npm run sync:wikidata-ids -- --stats   # Show current stats
 *   npm run sync:wikidata-ids -- --dry-run # Preview without saving
 *   npm run sync:wikidata-ids -- --limit=100 # Process only 100 politicians
 */

import "dotenv/config";
import { createCLI, type SyncHandler, type SyncResult } from "../src/lib/sync";
import { parseDate } from "../src/lib/parsing";
import { db } from "../src/lib/db";
import { DataSource } from "../src/generated/prisma";

const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const DELAY_BETWEEN_REQUESTS_MS = 200;

// Political position IDs in Wikidata (P39 values that indicate French politicians)
const POLITICAL_POSITIONS = new Set([
  "Q3044918", // député français
  "Q3044923", // sénateur français
  "Q21032547", // ministre français
  "Q19546", // député européen
  "Q21603893", // maire
  "Q26125059", // conseiller régional français
  "Q27169", // conseiller général
  "Q311065", // deputy mayor
  "Q83307", // ministre (general)
  "Q4164871", // position held (general)
  "Q30461", // président de la République française
  "Q2105858", // Premier ministre français
  "Q1127811", // député (general)
  "Q15686806", // membre de l'Assemblée nationale
  "Q18941264", // membre du Sénat
]) as const;

interface WikidataEntity {
  id: string;
  label: string;
  description?: string;
  birthDate?: string;
  isPolitician: boolean;
  positions: string[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Search Wikidata for a person by name
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

  const ids = data.search.map((s: { id: string }) => s.id);
  return fetchEntityDetails(ids);
}

/**
 * Fetch entity details to verify it's a French politician
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
        birthDate = timeValue.replace(/^\+/, "").split("T")[0];
      }
    }

    // Get positions held (P39)
    const positionClaims = entity.claims?.P39 || [];
    const positions: string[] = [];
    let isPolitician = false;

    for (const claim of positionClaims) {
      const positionId = claim?.mainsnak?.datavalue?.value?.id;
      if (positionId) {
        positions.push(positionId);
        if (POLITICAL_POSITIONS.has(positionId)) {
          isPolitician = true;
        }
      }
    }

    // Check occupation (P106) for politician
    const occupationClaims = entity.claims?.P106 || [];
    for (const claim of occupationClaims) {
      const occupationId = claim?.mainsnak?.datavalue?.value?.id;
      if (occupationId === "Q82955") {
        isPolitician = true;
      }
    }

    const label = entity.labels?.fr?.value || entity.labels?.en?.value || id;

    results.push({
      id,
      label,
      birthDate,
      isPolitician,
      positions,
    });
  }

  return results;
}

/**
 * Check if two dates match (within tolerance)
 */
function datesMatch(date1: Date | null, date2: Date | null, toleranceDays = 5): boolean {
  if (!date1 || !date2) return true;
  const diff = Math.abs(date1.getTime() - date2.getTime());
  const daysDiff = diff / (1000 * 60 * 60 * 24);
  return daysDiff <= toleranceDays;
}

/**
 * Find best match among candidates
 */
function findBestMatch(
  candidates: WikidataEntity[],
  politicianBirthDate: Date | null
): WikidataEntity | null {
  if (candidates.length === 1) {
    return candidates[0];
  }

  // Strategy 1: Match by birth date
  for (const candidate of candidates) {
    if (candidate.birthDate && politicianBirthDate) {
      const wdDate = parseDate(candidate.birthDate);
      if (datesMatch(politicianBirthDate, wdDate)) {
        return candidate;
      }
    }
  }

  // Strategy 2: Filter to only politicians
  const politicianCandidates = candidates.filter((c) => c.isPolitician);

  if (politicianCandidates.length === 1) {
    return politicianCandidates[0];
  }

  if (politicianCandidates.length > 1 && politicianBirthDate) {
    for (const candidate of politicianCandidates) {
      if (candidate.birthDate) {
        const wdDate = parseDate(candidate.birthDate);
        if (datesMatch(politicianBirthDate, wdDate)) {
          return candidate;
        }
      }
    }
  }

  if (politicianCandidates.length > 1 && !politicianBirthDate) {
    const withPositions = politicianCandidates.filter((c) => c.positions.length > 0);
    if (withPositions.length === 1) {
      return withPositions[0];
    }
  }

  // Strategy 3: Take the one with most positions
  if (candidates.length > 0) {
    const sortedByPositions = [...candidates].sort(
      (a, b) => b.positions.length - a.positions.length
    );
    if (
      sortedByPositions[0].positions.length > 0 &&
      (sortedByPositions.length === 1 ||
        sortedByPositions[0].positions.length > sortedByPositions[1].positions.length * 2)
    ) {
      return sortedByPositions[0];
    }
  }

  return null;
}

const handler: SyncHandler = {
  name: "Politic Tracker - Wikidata ID Sync",
  description: "Associate Wikidata IDs to politicians by name matching",

  showHelp() {
    console.log(`
Politic Tracker - Wikidata ID Sync

Strategy: For each politician in our DB, search Wikidata by name and match
by birth date when there are multiple candidates.
    `);
  },

  async showStats() {
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
    console.log(
      `With Wikidata ID: ${withWikidata} (${((withWikidata / totalPoliticians) * 100).toFixed(1)}%)`
    );
    console.log(`Without Wikidata ID: ${withoutWikidata}`);
  },

  async sync(options): Promise<SyncResult> {
    const { dryRun = false, limit } = options;

    const stats = {
      politiciansProcessed: 0,
      idsCreated: 0,
      alreadyUsed: 0,
      noMatch: 0,
      multipleMatches: 0,
    };
    const errors: string[] = [];

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
      take: limit as number | undefined,
      orderBy: { lastName: "asc" },
    });

    console.log(`Found ${politicians.length} politicians without Wikidata ID\n`);

    for (let i = 0; i < politicians.length; i++) {
      const politician = politicians[i];
      stats.politiciansProcessed++;

      try {
        const candidates = await searchWikidataByName(politician.fullName);

        if (candidates.length === 0) {
          stats.noMatch++;
          continue;
        }

        const bestMatch = findBestMatch(candidates, politician.birthDate);

        if (!bestMatch) {
          stats.multipleMatches++;
          continue;
        }

        const wikidataId = bestMatch.id;
        const matchReason = bestMatch.isPolitician
          ? `(politician, ${bestMatch.positions.length} positions)`
          : `(${bestMatch.positions.length} positions)`;

        if (dryRun) {
          console.log(`[DRY-RUN] ${politician.fullName} -> ${wikidataId} ${matchReason}`);
          stats.idsCreated++;
        } else {
          const existing = await db.externalId.findUnique({
            where: {
              source_externalId: {
                source: DataSource.WIKIDATA,
                externalId: wikidataId,
              },
            },
          });

          if (existing) {
            stats.alreadyUsed++;
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
          stats.idsCreated++;
          console.log(`✓ ${politician.fullName} -> ${wikidataId} ${matchReason}`);
        }
      } catch (error) {
        errors.push(`${politician.fullName}: ${error}`);
      }

      if ((i + 1) % 50 === 0) {
        const progress = (((i + 1) / politicians.length) * 100).toFixed(0);
        console.log(
          `\n--- Progress: ${progress}% (${i + 1}/${politicians.length}) | Created: ${stats.idsCreated} ---\n`
        );
      }

      await sleep(DELAY_BETWEEN_REQUESTS_MS);
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
