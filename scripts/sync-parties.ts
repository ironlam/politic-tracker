/**
 * CLI script to sync French political parties
 *
 * Combines:
 * - Local config (colors, display names, custom overrides)
 * - Wikidata enrichment (dates, ideologies, logos)
 *
 * Usage:
 *   npx tsx scripts/sync-parties.ts          # Full sync
 *   npx tsx scripts/sync-parties.ts --config # Only apply local config
 *   npx tsx scripts/sync-parties.ts --stats  # Show current stats
 *   npx tsx scripts/sync-parties.ts --help   # Show help
 */

import "dotenv/config";
import { db } from "../src/lib/db";
import { DataSource, PoliticalPosition } from "../src/generated/prisma";
import {
  FRENCH_ASSEMBLY_PARTIES,
  FRENCH_SENATE_PARTIES,
  PartyConfig,
} from "../src/config/parties";

// Combine all party configs
const ALL_PARTY_CONFIGS: Record<string, PartyConfig> = {
  ...FRENCH_ASSEMBLY_PARTIES,
  ...FRENCH_SENATE_PARTIES,
};

// Wikidata SPARQL endpoint
const WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql";

// Map Wikidata political position IDs to our enum
const POLITICAL_POSITION_MAP: Record<string, PoliticalPosition> = {
  Q49768: PoliticalPosition.FAR_RIGHT,
  Q3909293: PoliticalPosition.RIGHT,
  Q844984: PoliticalPosition.CENTER_RIGHT,
  Q28738992: PoliticalPosition.CENTER,
  Q1293577: PoliticalPosition.CENTER,
  Q844839: PoliticalPosition.CENTER_LEFT,
  Q2169699: PoliticalPosition.LEFT,
  Q214503: PoliticalPosition.FAR_LEFT,
};

interface WikidataPartyResult {
  party: { value: string };
  partyLabel: { value: string };
  shortName?: { value: string };
  foundedDate?: { value: string };
  dissolvedDate?: { value: string };
  color?: { value: string };
  logo?: { value: string };
  website?: { value: string };
  headquarters?: { value: string };
  ideology?: { value: string };
  position?: { value: string };
}

interface SyncResult {
  configUpdated: number;
  wikidataUpdated: number;
  wikidataCreated: number;
  skipped: number;
  errors: string[];
}

/**
 * Apply local config to existing parties (colors, names)
 */
async function applyLocalConfig(): Promise<{ updated: number; notFound: string[] }> {
  console.log("\n📋 Applying local party configuration...");

  let updated = 0;
  const notFound: string[] = [];

  for (const [abbrev, config] of Object.entries(ALL_PARTY_CONFIGS)) {
    // Find party by shortName
    const party = await db.party.findUnique({
      where: { shortName: config.shortName },
    });

    if (!party) {
      // Try by name
      const byName = await db.party.findUnique({
        where: { name: config.fullName },
      });

      if (!byName) {
        notFound.push(`${abbrev} (${config.shortName})`);
        continue;
      }
    }

    const partyId = party?.id;
    if (!partyId) continue;

    // Update with local config (prioritize local colors)
    await db.party.update({
      where: { id: partyId },
      data: {
        color: config.color, // Local config takes priority
      },
    });

    // Link Wikidata ID if specified
    if (config.wikidataId) {
      await db.externalId.upsert({
        where: {
          source_externalId: {
            source: DataSource.WIKIDATA,
            externalId: config.wikidataId,
          },
        },
        create: {
          partyId,
          source: DataSource.WIKIDATA,
          externalId: config.wikidataId,
          url: `https://www.wikidata.org/wiki/${config.wikidataId}`,
        },
        update: {
          partyId,
        },
      });
    }

    updated++;
  }

  console.log(`  Updated ${updated} parties from local config`);
  if (notFound.length > 0) {
    console.log(`  Not found in DB: ${notFound.slice(0, 5).join(", ")}${notFound.length > 5 ? ` (+${notFound.length - 5} more)` : ""}`);
  }

  return { updated, notFound };
}

/**
 * Query Wikidata for French political parties
 */
async function fetchWikidataParties(): Promise<WikidataPartyResult[]> {
  const query = `
    SELECT DISTINCT ?party ?partyLabel ?shortName ?foundedDate ?dissolvedDate ?color ?logo ?website ?headquarters
           (GROUP_CONCAT(DISTINCT ?ideologyLabel; SEPARATOR=", ") AS ?ideology)
           (SAMPLE(?positionId) AS ?position)
    WHERE {
      ?party wdt:P31/wdt:P279* wd:Q7278 .  # instance of political party or subclass
      ?party wdt:P17 wd:Q142 .              # country: France

      OPTIONAL { ?party wdt:P1813 ?shortName }
      OPTIONAL { ?party wdt:P571 ?foundedDate }
      OPTIONAL { ?party wdt:P576 ?dissolvedDate }
      OPTIONAL { ?party wdt:P465 ?color }
      OPTIONAL { ?party wdt:P154 ?logo }
      OPTIONAL { ?party wdt:P856 ?website }
      OPTIONAL { ?party wdt:P159 ?hq . ?hq rdfs:label ?headquarters . FILTER(LANG(?headquarters) = "fr") }
      OPTIONAL { ?party wdt:P1142 ?ideologyItem . ?ideologyItem rdfs:label ?ideologyLabel . FILTER(LANG(?ideologyLabel) = "fr") }
      OPTIONAL { ?party wdt:P1387 ?positionId }

      SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en" }
    }
    GROUP BY ?party ?partyLabel ?shortName ?foundedDate ?dissolvedDate ?color ?logo ?website ?headquarters
    ORDER BY DESC(?foundedDate)
    LIMIT 500
  `;

  const url = new URL(WIKIDATA_ENDPOINT);
  url.searchParams.set("query", query);

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
  return data.results.bindings;
}

/**
 * Enrich existing parties with Wikidata data
 */
async function enrichFromWikidata(): Promise<{ updated: number; created: number; skipped: number }> {
  console.log("\n🌐 Enriching parties from Wikidata...");

  const results = await fetchWikidataParties();
  console.log(`  Found ${results.length} parties in Wikidata`);

  let updated = 0;
  let created = 0;
  let skipped = 0;

  for (const result of results) {
    const wikidataId = result.party.value.split("/").pop() || "";
    const name = result.partyLabel.value;

    // Skip unresolved Q-numbers
    if (/^Q\d+$/.test(name)) {
      skipped++;
      continue;
    }

    // Skip very old parties (before 1958)
    if (result.dissolvedDate?.value) {
      const dissolvedYear = new Date(result.dissolvedDate.value).getFullYear();
      if (dissolvedYear < 1958) {
        skipped++;
        continue;
      }
    }

    // Prepare Wikidata data
    const shortName = result.shortName?.value || null;
    const foundedDate = result.foundedDate?.value ? new Date(result.foundedDate.value) : null;
    const dissolvedDate = result.dissolvedDate?.value ? new Date(result.dissolvedDate.value) : null;
    const wikidataColor = result.color?.value ? (result.color.value.startsWith("#") ? result.color.value : `#${result.color.value}`) : null;
    const logoUrl = result.logo?.value || null;
    const website = result.website?.value || null;
    const headquarters = result.headquarters?.value || null;
    const ideology = result.ideology?.value || null;
    const positionId = result.position?.value?.split("/").pop() || "";
    const politicalPosition = POLITICAL_POSITION_MAP[positionId] || null;

    try {
      // 1. Try to find existing party by Wikidata ID
      const existingByWikidata = await db.externalId.findUnique({
        where: {
          source_externalId: {
            source: DataSource.WIKIDATA,
            externalId: wikidataId,
          },
        },
        include: { party: true },
      });

      if (existingByWikidata?.party) {
        // Update with Wikidata data (but keep local color if set)
        const party = existingByWikidata.party;
        await db.party.update({
          where: { id: party.id },
          data: {
            foundedDate: foundedDate || party.foundedDate,
            dissolvedDate: dissolvedDate || party.dissolvedDate,
            // Only use Wikidata color if no local color
            color: party.color || wikidataColor,
            logoUrl: logoUrl || party.logoUrl,
            website: website || party.website,
            headquarters: headquarters || party.headquarters,
            ideology: ideology || party.ideology,
            politicalPosition: politicalPosition || party.politicalPosition,
          },
        });
        updated++;
        continue;
      }

      // 2. Try to find by name or shortName
      let party = await db.party.findFirst({
        where: {
          OR: [
            { name: { equals: name, mode: "insensitive" } },
            ...(shortName ? [{ shortName: { equals: shortName, mode: "insensitive" } }] : []),
          ],
        },
      });

      if (party) {
        // Link and update
        await db.party.update({
          where: { id: party.id },
          data: {
            foundedDate: foundedDate || party.foundedDate,
            dissolvedDate: dissolvedDate || party.dissolvedDate,
            color: party.color || wikidataColor,
            logoUrl: logoUrl || party.logoUrl,
            website: website || party.website,
            headquarters: headquarters || party.headquarters,
            ideology: ideology || party.ideology,
            politicalPosition: politicalPosition || party.politicalPosition,
          },
        });

        await db.externalId.upsert({
          where: {
            source_externalId: {
              source: DataSource.WIKIDATA,
              externalId: wikidataId,
            },
          },
          create: {
            partyId: party.id,
            source: DataSource.WIKIDATA,
            externalId: wikidataId,
            url: `https://www.wikidata.org/wiki/${wikidataId}`,
          },
          update: {
            partyId: party.id,
          },
        });

        updated++;
        continue;
      }

      // 3. Skip creation if no shortName (we don't create parties without shortName)
      if (!shortName) {
        skipped++;
        continue;
      }

      // Skip if shortName already exists
      const existingShort = await db.party.findUnique({
        where: { shortName },
      });

      if (existingShort) {
        skipped++;
        continue;
      }

      // Create new party
      party = await db.party.create({
        data: {
          name,
          shortName,
          foundedDate,
          dissolvedDate,
          color: wikidataColor,
          logoUrl,
          website,
          headquarters,
          ideology,
          politicalPosition,
        },
      });

      await db.externalId.create({
        data: {
          partyId: party.id,
          source: DataSource.WIKIDATA,
          externalId: wikidataId,
          url: `https://www.wikidata.org/wiki/${wikidataId}`,
        },
      });

      created++;
    } catch {
      skipped++;
    }
  }

  console.log(`  Updated: ${updated}, Created: ${created}, Skipped: ${skipped}`);
  return { updated, created, skipped };
}

/**
 * Show party statistics
 */
async function showStats() {
  const totalParties = await db.party.count();
  const withWikidata = await db.externalId.count({
    where: { source: DataSource.WIKIDATA, partyId: { not: null } },
  });

  const byPosition = await db.party.groupBy({
    by: ["politicalPosition"],
    _count: true,
    orderBy: { _count: { politicalPosition: "desc" } },
  });

  console.log("\n📊 Party Statistics:");
  console.log(`  Total parties: ${totalParties}`);
  console.log(`  With Wikidata ID: ${withWikidata}`);
  console.log("\n  By political position:");
  for (const p of byPosition) {
    console.log(`    ${p.politicalPosition || "Unknown"}: ${p._count}`);
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Politic Tracker - Party Sync CLI

Usage:
  npx tsx scripts/sync-parties.ts          Full sync (local config + Wikidata)
  npx tsx scripts/sync-parties.ts --config Only apply local config (colors, etc.)
  npx tsx scripts/sync-parties.ts --stats  Show current statistics
  npx tsx scripts/sync-parties.ts --help   Show this help message

Data sources:
  - src/config/parties.ts (local colors, display names)
  - Wikidata (dates, ideologies, logos, positions)
    `);
    process.exit(0);
  }

  console.log("=".repeat(50));
  console.log("Politic Tracker - Party Sync");
  console.log("=".repeat(50));

  if (args.includes("--stats")) {
    await showStats();
    process.exit(0);
  }

  const startTime = Date.now();

  // Step 1: Apply local config first (takes priority)
  const configResult = await applyLocalConfig();

  // Step 2: Enrich from Wikidata (unless --config only)
  let wikidataResult = { updated: 0, created: 0, skipped: 0 };
  if (!args.includes("--config")) {
    wikidataResult = await enrichFromWikidata();
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("\n" + "=".repeat(50));
  console.log("Sync Results:");
  console.log("=".repeat(50));
  console.log(`Duration: ${duration}s`);
  console.log(`\nLocal Config:`);
  console.log(`  Updated: ${configResult.updated}`);
  console.log(`\nWikidata:`);
  console.log(`  Updated: ${wikidataResult.updated}`);
  console.log(`  Created: ${wikidataResult.created}`);
  console.log(`  Skipped: ${wikidataResult.skipped}`);

  await showStats();

  console.log("\n" + "=".repeat(50));
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
