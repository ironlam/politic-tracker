import { db } from "@/lib/db";
import { DataSource } from "@/generated/prisma";
import { HTTPClient } from "@/lib/api/http-client";
import { WIKIDATA_SPARQL_RATE_LIMIT_MS } from "@/config/rate-limits";

const sparqlClient = new HTTPClient({ rateLimitMs: WIKIDATA_SPARQL_RATE_LIMIT_MS });

interface DeceasedSyncResult {
  success: boolean;
  checked: number;
  updated: number;
  errors: string[];
}

/**
 * Fetch death dates from Wikidata for politicians with Wikidata IDs
 */
async function fetchDeathDatesFromWikidata(wikidataIds: string[]): Promise<Map<string, Date>> {
  const results = new Map<string, Date>();

  // Process in batches of 50 to avoid URL length limits
  const batchSize = 50;
  for (let i = 0; i < wikidataIds.length; i += batchSize) {
    const batch = wikidataIds.slice(i, i + batchSize);
    const values = batch.map((id) => `wd:${id}`).join(" ");

    const query = `
      SELECT ?person ?deathDate WHERE {
        VALUES ?person { ${values} }
        ?person wdt:P570 ?deathDate .
      }
    `;

    try {
      const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`;
      const { data } = await sparqlClient.get<{
        results?: {
          bindings: Array<{ person?: { value: string }; deathDate?: { value: string } }>;
        };
      }>(url);

      for (const binding of data.results?.bindings || []) {
        const wikidataId = binding.person?.value?.replace("http://www.wikidata.org/entity/", "");
        const deathDateStr = binding.deathDate?.value;

        if (wikidataId && deathDateStr) {
          const deathDate = new Date(deathDateStr);
          if (!isNaN(deathDate.getTime())) {
            results.set(wikidataId, deathDate);
          }
        }
      }
    } catch (error) {
      console.warn(`Error querying Wikidata batch: ${error}`);
    }
  }

  return results;
}

/**
 * Sync death dates from Wikidata for all politicians with Wikidata IDs
 */
export async function syncDeceasedFromWikidata(): Promise<DeceasedSyncResult> {
  const result: DeceasedSyncResult = {
    success: false,
    checked: 0,
    updated: 0,
    errors: [],
  };

  try {
    console.log("Starting deceased sync from Wikidata...");

    // Get all politicians with Wikidata IDs who don't have a death date yet
    const politiciansWithWikidata = await db.externalId.findMany({
      where: {
        source: DataSource.WIKIDATA,
        politician: {
          deathDate: null,
        },
      },
      select: {
        externalId: true,
        politicianId: true,
        politician: {
          select: { fullName: true },
        },
      },
    });

    console.log(`Found ${politiciansWithWikidata.length} politicians with Wikidata IDs to check`);
    result.checked = politiciansWithWikidata.length;

    if (politiciansWithWikidata.length === 0) {
      result.success = true;
      return result;
    }

    // Fetch death dates from Wikidata
    const wikidataIds = politiciansWithWikidata.map((p) => p.externalId);
    const deathDates = await fetchDeathDatesFromWikidata(wikidataIds);

    console.log(`Found ${deathDates.size} death dates in Wikidata`);

    // Update politicians with death dates
    for (const politician of politiciansWithWikidata) {
      const deathDate = deathDates.get(politician.externalId);
      if (deathDate && politician.politicianId) {
        await db.politician.update({
          where: { id: politician.politicianId },
          data: { deathDate },
        });
        result.updated++;
        console.log(
          `Updated ${politician.politician?.fullName}: deceased ${deathDate.toISOString().split("T")[0]}`
        );
      }
    }

    result.success = true;
    console.log("\nDeceased sync completed:", result);
  } catch (error) {
    result.errors.push(String(error));
    console.error("Deceased sync failed:", error);
  }

  return result;
}

/**
 * Mark mandates as not current for deceased politicians
 */
export async function updateDeceasedMandates(): Promise<number> {
  // Find deceased politicians with current mandates
  const result = await db.mandate.updateMany({
    where: {
      isCurrent: true,
      politician: {
        deathDate: { not: null },
      },
    },
    data: {
      isCurrent: false,
    },
  });

  console.log(`Marked ${result.count} mandates as not current for deceased politicians`);
  return result.count;
}

/**
 * Get stats on deceased politicians
 */
export async function getDeceasedStats() {
  const [total, deceased, deceasedWithCurrentMandate] = await Promise.all([
    db.politician.count(),
    db.politician.count({ where: { deathDate: { not: null } } }),
    db.politician.count({
      where: {
        deathDate: { not: null },
        mandates: { some: { isCurrent: true } },
      },
    }),
  ]);

  return {
    total,
    deceased,
    alive: total - deceased,
    deceasedWithCurrentMandate,
  };
}
