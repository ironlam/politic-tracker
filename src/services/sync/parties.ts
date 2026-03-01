/**
 * Service to sync French political parties from local config + Wikidata.
 * Extracted from scripts/sync-parties.ts for Inngest compatibility.
 */

import { db } from "@/lib/db";
import { DataSource, PoliticalPosition } from "@/generated/prisma";
import { FRENCH_ASSEMBLY_PARTIES, FRENCH_SENATE_PARTIES, type PartyConfig } from "@/config/parties";
import { generateSlug } from "@/lib/utils";
import { HTTPClient } from "@/lib/api/http-client";
import { WIKIDATA_SPARQL_RATE_LIMIT_MS } from "@/config/rate-limits";
import { createHash } from "crypto";

export interface PartiesSyncResult {
  configUpdated: number;
  wikidataUpdated: number;
  wikidataCreated: number;
  skipped: number;
  errors: string[];
}

const ALL_PARTY_CONFIGS: Record<string, PartyConfig> = {
  ...FRENCH_ASSEMBLY_PARTIES,
  ...FRENCH_SENATE_PARTIES,
};

const WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql";

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

/**
 * Convert Wikidata Special:FilePath URLs to direct upload.wikimedia.org URLs.
 * Wikidata returns http://commons.wikimedia.org/wiki/Special:FilePath/Name.svg
 * which is a redirect — Next.js Image can't follow redirects.
 */
function normalizeWikimediaUrl(url: string): string {
  // Ensure https
  let normalized = url.replace(/^http:\/\//, "https://");
  // Convert Special:FilePath to direct URL
  const match = normalized.match(/Special:FilePath\/(.+)$/);
  if (match) {
    const filename = decodeURIComponent(match[1]!).replace(/ /g, "_");
    const hash = createHash("md5").update(filename).digest("hex");
    const encodedFilename = encodeURIComponent(filename).replace(/%2F/g, "/");
    normalized = `https://upload.wikimedia.org/wikipedia/commons/${hash[0]}/${hash.slice(0, 2)}/${encodedFilename}`;
  }
  return normalized;
}

async function applyLocalConfig(): Promise<{
  updated: number;
  notFound: string[];
}> {
  console.log("Applying local party configuration...");

  let updated = 0;
  const notFound: string[] = [];

  for (const [abbrev, config] of Object.entries(ALL_PARTY_CONFIGS)) {
    const party = await db.party.findUnique({
      where: { shortName: config.shortName },
    });

    if (!party) {
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

    await db.party.update({
      where: { id: partyId },
      data: { color: config.color },
    });

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
        update: { partyId },
      });
    }

    updated++;
  }

  console.log(`  Updated ${updated} parties from local config`);
  if (notFound.length > 0) {
    console.log(
      `  Not found: ${notFound.slice(0, 5).join(", ")}${notFound.length > 5 ? ` (+${notFound.length - 5} more)` : ""}`
    );
  }

  return { updated, notFound };
}

async function fetchWikidataParties(): Promise<WikidataPartyResult[]> {
  const sparqlClient = new HTTPClient({
    rateLimitMs: WIKIDATA_SPARQL_RATE_LIMIT_MS,
  });

  const query = `
    SELECT DISTINCT ?party ?partyLabel ?shortName ?foundedDate ?dissolvedDate ?color ?logo ?website ?headquarters
           (GROUP_CONCAT(DISTINCT ?ideologyLabel; SEPARATOR=", ") AS ?ideology)
           (SAMPLE(?positionId) AS ?position)
    WHERE {
      ?party wdt:P31/wdt:P279* wd:Q7278 .
      ?party wdt:P17 wd:Q142 .
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

  const { data } = await sparqlClient.get<{
    results: { bindings: WikidataPartyResult[] };
  }>(url.toString(), { headers: { Accept: "application/json" } });
  return data.results.bindings;
}

async function enrichFromWikidata(): Promise<{
  updated: number;
  created: number;
  skipped: number;
}> {
  console.log("Enriching parties from Wikidata...");

  const results = await fetchWikidataParties();
  console.log(`  Found ${results.length} parties in Wikidata`);

  let updated = 0;
  let created = 0;
  let skipped = 0;

  for (const result of results) {
    const wikidataId = result.party.value.split("/").pop() || "";
    const name = result.partyLabel.value;

    if (/^Q\d+$/.test(name)) {
      skipped++;
      continue;
    }

    if (result.dissolvedDate?.value) {
      const dissolvedYear = new Date(result.dissolvedDate.value).getFullYear();
      if (dissolvedYear < 1958) {
        skipped++;
        continue;
      }
    }

    const shortName = result.shortName?.value || null;
    const foundedDate = result.foundedDate?.value ? new Date(result.foundedDate.value) : null;
    const dissolvedDate = result.dissolvedDate?.value ? new Date(result.dissolvedDate.value) : null;
    const wikidataColor = result.color?.value
      ? result.color.value.startsWith("#")
        ? result.color.value
        : `#${result.color.value}`
      : null;
    const logoUrl = result.logo?.value ? normalizeWikimediaUrl(result.logo.value) : null;
    const website = result.website?.value || null;
    const headquarters = result.headquarters?.value || null;
    const ideology = result.ideology?.value || null;
    const positionId = result.position?.value?.split("/").pop() || "";
    const politicalPosition = POLITICAL_POSITION_MAP[positionId] || null;

    try {
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
        const party = existingByWikidata.party;
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
            ...(!party.politicalPositionOverride && politicalPosition
              ? {
                  politicalPosition,
                  politicalPositionSource: "wikidata",
                  politicalPositionSourceUrl: `https://www.wikidata.org/wiki/${wikidataId}`,
                }
              : {}),
          },
        });
        updated++;
        continue;
      }

      let party = await db.party.findFirst({
        where: {
          OR: [
            { name: { equals: name, mode: "insensitive" as const } },
            ...(shortName
              ? [
                  {
                    shortName: {
                      equals: shortName,
                      mode: "insensitive" as const,
                    },
                  },
                ]
              : []),
          ],
        },
      });

      if (party) {
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
            ...(!party.politicalPositionOverride && politicalPosition
              ? {
                  politicalPosition,
                  politicalPositionSource: "wikidata",
                  politicalPositionSourceUrl: `https://www.wikidata.org/wiki/${wikidataId}`,
                }
              : {}),
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
          update: { partyId: party.id },
        });

        updated++;
        continue;
      }

      if (!shortName) {
        skipped++;
        continue;
      }

      // Skip dissolved parties (>30 years)
      if (dissolvedDate) {
        const yearsAgo = (Date.now() - dissolvedDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        if (yearsAgo > 30) {
          skipped++;
          continue;
        }
      }

      const existingShort = await db.party.findUnique({
        where: { shortName },
      });
      if (existingShort) {
        skipped++;
        continue;
      }

      party = await db.party.create({
        data: {
          name,
          shortName,
          slug: generateSlug(name),
          foundedDate,
          dissolvedDate,
          color: wikidataColor,
          logoUrl,
          website,
          headquarters,
          ideology,
          politicalPosition,
          politicalPositionSource: politicalPosition ? "wikidata" : null,
          politicalPositionSourceUrl: politicalPosition
            ? `https://www.wikidata.org/wiki/${wikidataId}`
            : null,
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

export async function syncParties(options?: { configOnly?: boolean }): Promise<PartiesSyncResult> {
  const { configOnly = false } = options ?? {};

  const stats: PartiesSyncResult = {
    configUpdated: 0,
    wikidataUpdated: 0,
    wikidataCreated: 0,
    skipped: 0,
    errors: [],
  };

  try {
    const configResult = await applyLocalConfig();
    stats.configUpdated = configResult.updated;

    if (!configOnly) {
      const wikidataResult = await enrichFromWikidata();
      stats.wikidataUpdated = wikidataResult.updated;
      stats.wikidataCreated = wikidataResult.created;
      stats.skipped = wikidataResult.skipped;
    }
  } catch (error) {
    stats.errors.push(String(error));
  }

  return stats;
}
