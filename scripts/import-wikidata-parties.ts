import { PrismaClient, PoliticalPosition, DataSource } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "dotenv";
import { generateSlug } from "../src/lib/utils";
import { HTTPClient } from "../src/lib/api/http-client";
import { WIKIDATA_SPARQL_RATE_LIMIT_MS } from "../src/config/rate-limits";

config();

const sparqlClient = new HTTPClient({ rateLimitMs: WIKIDATA_SPARQL_RATE_LIMIT_MS });

// Initialize Prisma
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

// Wikidata SPARQL endpoint
const WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql";

// Map Wikidata political position IDs to our enum
const POLITICAL_POSITION_MAP: Record<string, PoliticalPosition> = {
  Q49768: "FAR_RIGHT", // extrême droite
  Q3909293: "RIGHT", // droite
  Q844984: "CENTER_RIGHT", // centre droit
  Q28738992: "CENTER", // centre
  Q1293577: "CENTER", // centrisme
  Q844839: "CENTER_LEFT", // centre gauche
  Q2169699: "LEFT", // gauche
  Q214503: "FAR_LEFT", // extrême gauche
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

  const { data } = await sparqlClient.get<{ results: { bindings: WikidataPartyResult[] } }>(
    url.toString(),
    { headers: { Accept: "application/json" } }
  );
  return data.results.bindings;
}

/**
 * Map Wikidata position to our enum
 */
function mapPosition(positionUrl?: string): PoliticalPosition | null {
  if (!positionUrl) return null;
  const wikidataId = positionUrl.split("/").pop() || "";
  return POLITICAL_POSITION_MAP[wikidataId] || null;
}

/**
 * Parse color from Wikidata (hex without #)
 */
function parseColor(color?: string): string | null {
  if (!color) return null;
  // Wikidata returns color without #, add it
  return color.startsWith("#") ? color : `#${color}`;
}

/**
 * Upsert Wikidata external ID for a party
 */
async function upsertPartyWikidataId(partyId: string, wikidataId: string): Promise<void> {
  await db.externalId.upsert({
    where: {
      source_externalId: {
        source: DataSource.WIKIDATA,
        externalId: wikidataId,
      },
    },
    create: {
      partyId,
      source: DataSource.WIKIDATA,
      externalId: wikidataId,
      url: `https://www.wikidata.org/wiki/${wikidataId}`,
    },
    update: {
      partyId,
      url: `https://www.wikidata.org/wiki/${wikidataId}`,
    },
  });
}

/**
 * Import or update a party from Wikidata
 */
async function importParty(result: WikidataPartyResult): Promise<boolean> {
  const wikidataId = result.party.value.split("/").pop() || "";
  const name = result.partyLabel.value;

  // Skip if name is just a Q-number (unresolved)
  if (/^Q\d+$/.test(name)) {
    console.log(`  Skipping unresolved: ${wikidataId}`);
    return false;
  }

  // Skip very old dissolved parties (before 1958)
  if (result.dissolvedDate?.value) {
    const dissolvedYear = new Date(result.dissolvedDate.value).getFullYear();
    if (dissolvedYear < 1958) {
      console.log(`  Skipping (dissolved ${dissolvedYear}): ${name}`);
      return false;
    }
  }

  // Prepare data
  const shortName = result.shortName?.value || null;
  const foundedDate = result.foundedDate?.value ? new Date(result.foundedDate.value) : null;
  const dissolvedDate = result.dissolvedDate?.value ? new Date(result.dissolvedDate.value) : null;
  const color = parseColor(result.color?.value);
  const logoUrl = result.logo?.value || null;
  const website = result.website?.value || null;
  const headquarters = result.headquarters?.value || null;
  const ideology = result.ideology?.value || null;
  const politicalPosition = mapPosition(result.position?.value);

  try {
    // 1. Try to find existing party by Wikidata ID first (most reliable)
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
      // Update existing party with new data
      await db.party.update({
        where: { id: existingByWikidata.party.id },
        data: {
          foundedDate: foundedDate || existingByWikidata.party.foundedDate,
          dissolvedDate: dissolvedDate || existingByWikidata.party.dissolvedDate,
          color: color || existingByWikidata.party.color,
          logoUrl: logoUrl || existingByWikidata.party.logoUrl,
          website: website || existingByWikidata.party.website,
          headquarters: headquarters || existingByWikidata.party.headquarters,
          ideology: ideology || existingByWikidata.party.ideology,
          politicalPosition: politicalPosition || existingByWikidata.party.politicalPosition,
        },
      });
      console.log(`  ↻ Updated: ${name}`);
      return true;
    }

    // 2. Try to find by name or shortName
    let party = await db.party.findFirst({
      where: {
        OR: [
          { name: { equals: name, mode: "insensitive" as const } },
          ...(shortName
            ? [{ shortName: { equals: shortName, mode: "insensitive" as const } }]
            : []),
        ],
      },
    });

    if (party) {
      // Link Wikidata ID and update
      await db.party.update({
        where: { id: party.id },
        data: {
          foundedDate: foundedDate || party.foundedDate,
          dissolvedDate: dissolvedDate || party.dissolvedDate,
          color: color || party.color,
          logoUrl: logoUrl || party.logoUrl,
          website: website || party.website,
          headquarters: headquarters || party.headquarters,
          ideology: ideology || party.ideology,
          politicalPosition: politicalPosition || party.politicalPosition,
        },
      });
      await upsertPartyWikidataId(party.id, wikidataId);
      console.log(`  ✓ Linked & updated: ${name} (${party.shortName})`);
      return true;
    }

    // 3. Create new party only if we have a shortName
    if (!shortName) {
      console.log(`  ⊘ Skipping (no shortName): ${name}`);
      return false;
    }

    // Check if shortName already exists
    const existingShort = await db.party.findUnique({
      where: { shortName },
    });

    if (existingShort) {
      console.log(`  ⊘ ShortName conflict: ${shortName} already used by ${existingShort.name}`);
      return false;
    }

    party = await db.party.create({
      data: {
        name,
        shortName,
        slug: generateSlug(name),
        foundedDate,
        dissolvedDate,
        color,
        logoUrl,
        website,
        headquarters,
        ideology,
        politicalPosition,
      },
    });
    await upsertPartyWikidataId(party.id, wikidataId);
    console.log(`  ✓ Created: ${name} (${shortName})`);
    return true;
  } catch (error) {
    console.error(`  ✗ Failed: ${name}`, error);
    return false;
  }
}

/**
 * Main import function
 */
async function main() {
  console.log("========================================");
  console.log("Wikidata Party Import");
  console.log("========================================\n");

  console.log("Fetching French political parties from Wikidata...");
  const results = await fetchWikidataParties();
  console.log(`Found ${results.length} parties\n`);

  let imported = 0;
  let skipped = 0;

  console.log("Importing parties...");
  for (const result of results) {
    const success = await importParty(result);
    if (success) imported++;
    else skipped++;
  }

  console.log(`\n========================================`);
  console.log(`Import complete!`);
  console.log(`  Imported/Updated: ${imported}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`========================================`);

  // Show current party stats
  const stats = await db.party.groupBy({
    by: ["politicalPosition"],
    _count: true,
  });
  console.log("\nParties by political position:");
  for (const s of stats) {
    console.log(`  ${s.politicalPosition || "Unknown"}: ${s._count}`);
  }

  await pool.end();
}

main().catch(console.error);
