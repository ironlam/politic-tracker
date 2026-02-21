/**
 * Service to enrich politicians with birth/death dates from Wikidata.
 * Extracted from scripts/sync-birthdates.ts for Inngest compatibility.
 */

import { WikidataService } from "@/lib/api";
import { db } from "@/lib/db";
import { DataSource } from "@/generated/prisma";
import { WIKIDATA_RATE_LIMIT_MS } from "@/config/rate-limits";

export interface BirthdatesSyncResult {
  processed: number;
  birthDatesAdded: number;
  deathDatesAdded: number;
  noDateInWikidata: number;
  errors: string[];
}

export async function syncBirthdates(options?: { limit?: number }): Promise<BirthdatesSyncResult> {
  const { limit } = options ?? {};
  const wikidata = new WikidataService({ rateLimitMs: WIKIDATA_RATE_LIMIT_MS });

  const stats: BirthdatesSyncResult = {
    processed: 0,
    birthDatesAdded: 0,
    deathDatesAdded: 0,
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
      deathDate: true,
      externalIds: {
        where: { source: DataSource.WIKIDATA },
        select: { externalId: true },
      },
    },
    take: limit,
    orderBy: { lastName: "asc" },
  });

  console.log(`Found ${politicians.length} politicians to process`);

  if (politicians.length === 0) {
    return stats;
  }

  // Build map of Wikidata ID -> politician
  const wikidataIdMap = new Map<string, (typeof politicians)[0]>();
  const wikidataIds: string[] = [];

  for (const politician of politicians) {
    const wikidataId = politician.externalIds[0]?.externalId;
    if (wikidataId) {
      wikidataIdMap.set(wikidataId, politician);
      wikidataIds.push(wikidataId);
    }
  }

  // Fetch life dates using the unified service (handles batching internally)
  console.log(`Fetching dates for ${wikidataIds.length} entities...`);
  const lifeDates = await wikidata.getLifeDates(wikidataIds);

  console.log("Updating database...");

  // Update politicians
  for (const [wikidataId, dates] of Array.from(lifeDates.entries())) {
    const politician = wikidataIdMap.get(wikidataId);
    if (!politician) continue;

    stats.processed++;

    if (!dates.birthDate) {
      stats.noDateInWikidata++;
      continue;
    }

    try {
      const updateData: { birthDate: Date; deathDate?: Date } = {
        birthDate: dates.birthDate,
      };
      if (dates.deathDate && !politician.deathDate) {
        updateData.deathDate = dates.deathDate;
      }

      await db.politician.update({
        where: { id: politician.id },
        data: updateData,
      });

      stats.birthDatesAdded++;
      if (dates.deathDate && !politician.deathDate) {
        stats.deathDatesAdded++;
      }
    } catch (error) {
      stats.errors.push(`${politician.fullName}: ${error}`);
    }
  }

  return stats;
}
