/**
 * Service to associate French MEPs with their national political party.
 * Uses Wikidata P102 (member of political party).
 * Extracted from scripts/sync-mep-parties.ts for Inngest compatibility.
 */

import { WikidataService } from "@/lib/api";
import type { WikidataPartyAffiliation } from "@/lib/api";
import { db } from "@/lib/db";
import { DataSource, MandateType } from "@/generated/prisma";
import { politicianService } from "@/services/politician";
import { WIKIDATA_SPARQL_RATE_LIMIT_MS } from "@/config/rate-limits";

export interface MepPartiesSyncResult {
  partiesSet: number;
  alreadyCorrect: number;
  partyNotInDB: number;
  noPartyFound: number;
  skippedHasParty: number;
  errors: string[];
}

function findCurrentAffiliation(
  affiliations: WikidataPartyAffiliation[]
): WikidataPartyAffiliation | null {
  if (affiliations.length === 0) return null;

  const current = affiliations.filter((a) => !a.endDate);
  if (current.length === 1) return current[0];

  if (current.length > 1) {
    return current.sort((a, b) => (b.startDate?.getTime() ?? 0) - (a.startDate?.getTime() ?? 0))[0];
  }

  return affiliations.sort((a, b) => (b.endDate?.getTime() ?? 0) - (a.endDate?.getTime() ?? 0))[0];
}

export async function syncMepParties(options?: {
  limit?: number;
  force?: boolean;
}): Promise<MepPartiesSyncResult> {
  const { limit, force = false } = options ?? {};

  const wikidata = new WikidataService({
    rateLimitMs: WIKIDATA_SPARQL_RATE_LIMIT_MS,
  });

  const stats: MepPartiesSyncResult = {
    partiesSet: 0,
    alreadyCorrect: 0,
    partyNotInDB: 0,
    noPartyFound: 0,
    skippedHasParty: 0,
    errors: [],
  };

  // 1. Load current MEPs with Wikidata IDs
  console.log("Fetching current MEPs with Wikidata IDs...");

  const meps = await db.politician.findMany({
    where: {
      mandates: {
        some: { type: MandateType.DEPUTE_EUROPEEN, isCurrent: true },
      },
      externalIds: { some: { source: DataSource.WIKIDATA } },
    },
    include: {
      externalIds: {
        where: { source: DataSource.WIKIDATA },
        take: 1,
      },
      currentParty: { select: { id: true, shortName: true } },
    },
    take: limit,
  });

  console.log(`Found ${meps.length} MEPs with Wikidata IDs`);

  if (meps.length === 0) {
    console.log("No MEPs with Wikidata IDs found. Run sync:wikidata-ids first.");
    return stats;
  }

  // 2. Build map: wikidataId → local party ID
  console.log("Building party Wikidata → local ID map...");

  const partyExternalIds = await db.externalId.findMany({
    where: {
      source: DataSource.WIKIDATA,
      partyId: { not: null },
    },
    select: {
      externalId: true,
      partyId: true,
    },
  });

  const wikidataToPartyId = new Map<string, string>();
  for (const ext of partyExternalIds) {
    if (ext.partyId) {
      wikidataToPartyId.set(ext.externalId, ext.partyId);
    }
  }

  console.log(`Found ${wikidataToPartyId.size} parties with Wikidata IDs`);

  // 3. Batch-fetch P102 from Wikidata
  const wikidataIds = meps.map((m) => m.externalIds[0]?.externalId).filter(Boolean) as string[];

  console.log(`Fetching P102 (political party) for ${wikidataIds.length} entities...`);
  const partiesMap = await wikidata.getPoliticalParties(wikidataIds);
  console.log(`Fetched party data for ${partiesMap.size} entities`);

  // 4. Process each MEP
  for (const mep of meps) {
    const wikidataId = mep.externalIds[0]?.externalId;
    if (!wikidataId) continue;

    // Skip if already has party and not --force
    if (mep.currentPartyId && !force) {
      stats.skippedHasParty++;
      continue;
    }

    const affiliations = partiesMap.get(wikidataId) || [];
    const current = findCurrentAffiliation(affiliations);

    if (!current) {
      stats.noPartyFound++;
      continue;
    }

    const localPartyId = wikidataToPartyId.get(current.partyWikidataId);

    if (!localPartyId) {
      stats.partyNotInDB++;
      continue;
    }

    // Check if already correct
    if (mep.currentPartyId === localPartyId) {
      stats.alreadyCorrect++;
      continue;
    }

    try {
      await politicianService.setCurrentParty(mep.id, localPartyId);
      stats.partiesSet++;
    } catch (error) {
      stats.errors.push(`${mep.fullName}: ${error}`);
    }
  }

  return stats;
}
