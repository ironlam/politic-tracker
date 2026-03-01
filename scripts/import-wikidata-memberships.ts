import { PrismaClient, DataSource } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "dotenv";
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

interface WikidataMembershipResult {
  person: { value: string };
  personLabel: { value: string };
  party: { value: string };
  partyLabel: { value: string };
  startDate?: { value: string };
  endDate?: { value: string };
}

/**
 * Query Wikidata for party memberships of French politicians
 */
async function fetchWikidataMemberships(): Promise<WikidataMembershipResult[]> {
  const query = `
    SELECT DISTINCT ?person ?personLabel ?party ?partyLabel ?startDate ?endDate WHERE {
      ?person wdt:P27 wd:Q142 .           # French citizen
      ?person wdt:P106 wd:Q82955 .        # occupation: politician

      ?person p:P102 ?membershipStatement .
      ?membershipStatement ps:P102 ?party .

      OPTIONAL { ?membershipStatement pq:P580 ?startDate }
      OPTIONAL { ?membershipStatement pq:P582 ?endDate }

      # Filter to Ve République era
      OPTIONAL { ?person wdt:P570 ?deathDate }
      FILTER (!BOUND(?deathDate) || YEAR(?deathDate) >= 1958)

      SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en" }
    }
    ORDER BY ?personLabel ?startDate
    LIMIT 5000
  `;

  const url = new URL(WIKIDATA_ENDPOINT);
  url.searchParams.set("query", query);

  console.log("Fetching party memberships from Wikidata...");
  const { data } = await sparqlClient.get<{ results: { bindings: WikidataMembershipResult[] } }>(
    url.toString(),
    { headers: { Accept: "application/json" } }
  );
  return data.results.bindings;
}

/**
 * Find politician by Wikidata ID or name
 */
async function findPolitician(wikidataId: string, name: string): Promise<string | null> {
  // 1. Try by Wikidata ID
  const byWikidata = await db.externalId.findUnique({
    where: {
      source_externalId: {
        source: DataSource.WIKIDATA,
        externalId: wikidataId,
      },
    },
    select: { politicianId: true },
  });

  if (byWikidata?.politicianId) {
    return byWikidata.politicianId;
  }

  // 2. Try by name
  const byName = await db.politician.findFirst({
    where: {
      OR: [
        { fullName: { equals: name, mode: "insensitive" as const } },
        { fullName: { contains: name, mode: "insensitive" as const } },
      ],
    },
    select: { id: true },
  });

  return byName?.id || null;
}

/**
 * Find party by Wikidata ID or name
 */
async function findParty(wikidataId: string, name: string): Promise<string | null> {
  // Skip unresolved Q-numbers
  if (/^Q\d+$/.test(name)) {
    return null;
  }

  // 1. Try by Wikidata ID
  const byWikidata = await db.externalId.findUnique({
    where: {
      source_externalId: {
        source: DataSource.WIKIDATA,
        externalId: wikidataId,
      },
    },
    select: { partyId: true },
  });

  if (byWikidata?.partyId) {
    return byWikidata.partyId;
  }

  // 2. Try by name (partial match)
  const byName = await db.party.findFirst({
    where: {
      OR: [
        { name: { equals: name, mode: "insensitive" as const } },
        { name: { contains: name, mode: "insensitive" as const } },
        { shortName: { equals: name, mode: "insensitive" as const } },
      ],
    },
    select: { id: true },
  });

  return byName?.id || null;
}

/**
 * Import party memberships
 */
async function importMemberships(results: WikidataMembershipResult[]): Promise<{
  created: number;
  skipped: number;
  politiciansUpdated: number;
}> {
  let created = 0;
  let skipped = 0;
  const politiciansToUpdate = new Map<string, { partyId: string; endDate: Date | null }>();

  // Group by person for efficient processing
  const byPerson = new Map<string, WikidataMembershipResult[]>();
  for (const result of results) {
    const personId = result.person.value.split("/").pop() || "";
    if (!byPerson.has(personId)) {
      byPerson.set(personId, []);
    }
    byPerson.get(personId)!.push(result);
  }

  console.log(`Processing ${byPerson.size} politicians with memberships...`);

  for (const [wikidataPersonId, memberships] of byPerson) {
    const personName = memberships[0]!.personLabel.value;

    // Find politician in our DB
    const politicianId = await findPolitician(wikidataPersonId, personName);
    if (!politicianId) {
      continue; // Politician not in our DB
    }

    // Process each membership
    for (const membership of memberships) {
      const wikidataPartyId = membership.party.value.split("/").pop() || "";
      const partyName = membership.partyLabel.value;

      // Find party
      const partyId = await findParty(wikidataPartyId, partyName);
      if (!partyId) {
        skipped++;
        continue;
      }

      // Parse and validate dates
      let startDate: Date;
      if (membership.startDate?.value) {
        const parsed = new Date(membership.startDate.value);
        startDate = isNaN(parsed.getTime()) ? new Date("1958-01-01") : parsed;
      } else {
        startDate = new Date("1958-01-01"); // Default to Ve République start
      }

      let endDate: Date | null = null;
      if (membership.endDate?.value) {
        const parsed = new Date(membership.endDate.value);
        endDate = isNaN(parsed.getTime()) ? null : parsed;
      }

      // Check if membership already exists
      const existing = await db.partyMembership.findFirst({
        where: {
          politicianId,
          partyId,
          startDate: {
            gte: new Date(startDate.getTime() - 86400000), // Within 1 day tolerance
            lte: new Date(startDate.getTime() + 86400000),
          },
        },
      });

      if (existing) {
        // Update end date if we have it and existing doesn't
        if (endDate && !existing.endDate) {
          await db.partyMembership.update({
            where: { id: existing.id },
            data: { endDate },
          });
        }
        continue;
      }

      // Create membership
      await db.partyMembership.create({
        data: {
          politicianId,
          partyId,
          startDate,
          endDate,
        },
      });
      created++;

      // Track most recent membership for each politician (for currentPartyId update)
      const current = politiciansToUpdate.get(politicianId);
      if (!endDate || !current || (current.endDate && endDate > current.endDate)) {
        // This membership is more recent
        if (!endDate) {
          // Still active - use this one
          politiciansToUpdate.set(politicianId, { partyId, endDate: null });
        } else if (!current || (current.endDate && endDate > current.endDate)) {
          politiciansToUpdate.set(politicianId, { partyId, endDate });
        }
      }
    }
  }

  // Update currentPartyId for politicians without one
  let politiciansUpdated = 0;
  for (const [politicianId, { partyId, endDate }] of politiciansToUpdate) {
    const politician = await db.politician.findUnique({
      where: { id: politicianId },
      select: { currentPartyId: true, fullName: true },
    });

    // Only update if no current party set
    if (politician && !politician.currentPartyId) {
      await db.politician.update({
        where: { id: politicianId },
        data: { currentPartyId: partyId },
      });
      console.log(
        `  → Linked ${politician.fullName} to party (${endDate ? "historical" : "current"})`
      );
      politiciansUpdated++;
    }
  }

  return { created, skipped, politiciansUpdated };
}

/**
 * Main function
 */
async function main() {
  console.log("========================================");
  console.log("Wikidata Party Memberships Import");
  console.log("========================================\n");

  try {
    const results = await fetchWikidataMemberships();
    console.log(`Found ${results.length} membership records\n`);

    const { created, skipped, politiciansUpdated } = await importMemberships(results);

    console.log("\n========================================");
    console.log("Import complete!");
    console.log(`  Memberships created: ${created}`);
    console.log(`  Skipped (party not found): ${skipped}`);
    console.log(`  Politicians linked to party: ${politiciansUpdated}`);
    console.log("========================================");

    // Show stats
    const membershipCount = await db.partyMembership.count();
    const withMembership = await db.politician.count({
      where: { partyHistory: { some: {} } },
    });

    console.log("\nDatabase stats:");
    console.log(`  Total memberships: ${membershipCount}`);
    console.log(`  Politicians with history: ${withMembership}`);
  } catch (error) {
    console.error("Import failed:", error);
  }

  await pool.end();
}

main();
