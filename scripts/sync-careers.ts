/**
 * CLI script to enrich politician careers from Wikidata
 *
 * Uses Wikidata property P39 (position held) to get historical mandates.
 *
 * Usage:
 *   npx tsx scripts/sync-careers.ts              # Sync careers for all politicians with Wikidata IDs
 *   npx tsx scripts/sync-careers.ts --stats      # Show current stats
 *   npx tsx scripts/sync-careers.ts --dry-run    # Preview without saving
 */

import "dotenv/config";
import { db } from "../src/lib/db";
import { MandateType, DataSource } from "../src/generated/prisma";

const WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql";

// Mapping from Wikidata position IDs to our MandateType
// Q* IDs are Wikidata entity IDs for political positions
const POSITION_MAPPING: Record<string, { type: MandateType; institution: string }> = {
  // National level
  "Q30461": { type: MandateType.PRESIDENT_REPUBLIQUE, institution: "Présidence de la République" },
  "Q1587677": { type: MandateType.PREMIER_MINISTRE, institution: "Gouvernement" },
  "Q83307": { type: MandateType.MINISTRE, institution: "Gouvernement" },
  "Q26261727": { type: MandateType.SECRETAIRE_ETAT, institution: "Gouvernement" },
  "Q3044918": { type: MandateType.DEPUTE, institution: "Assemblée nationale" },
  "Q21032547": { type: MandateType.DEPUTE, institution: "Assemblée nationale" }, // member of the National Assembly of France
  "Q18941264": { type: MandateType.DEPUTE, institution: "Assemblée nationale" }, // député de la XVIe législature
  "Q55648587": { type: MandateType.DEPUTE, institution: "Assemblée nationale" }, // député de la XVIIe législature
  "Q3044923": { type: MandateType.SENATEUR, institution: "Sénat" },
  "Q18558628": { type: MandateType.SENATEUR, institution: "Sénat" }, // membre du Sénat français
  "Q27169": { type: MandateType.DEPUTE_EUROPEEN, institution: "Parlement européen" },

  // Local level
  "Q30185": { type: MandateType.MAIRE, institution: "Mairie" },
  "Q382617": { type: MandateType.ADJOINT_MAIRE, institution: "Mairie" },
  "Q19546": { type: MandateType.PRESIDENT_REGION, institution: "Conseil régional" },
  "Q1805817": { type: MandateType.PRESIDENT_DEPARTEMENT, institution: "Conseil départemental" },
  "Q1162444": { type: MandateType.CONSEILLER_REGIONAL, institution: "Conseil régional" },
  "Q21032554": { type: MandateType.CONSEILLER_DEPARTEMENTAL, institution: "Conseil départemental" },
  "Q17519573": { type: MandateType.CONSEILLER_MUNICIPAL, institution: "Conseil municipal" },
};

interface WikidataPositionResult {
  person: { value: string };
  personLabel: { value: string };
  position: { value: string };
  positionLabel: { value: string };
  startDate?: { value: string };
  endDate?: { value: string };
  constituency?: { value: string };
  constituencyLabel?: { value: string };
  ofLabel?: { value: string }; // "of" qualifier (e.g., "Mayor of Paris")
}

/**
 * Query Wikidata for positions held by French politicians
 */
async function fetchWikidataPositions(wikidataIds: string[]): Promise<WikidataPositionResult[]> {
  if (wikidataIds.length === 0) return [];

  // Build VALUES clause for the Wikidata IDs
  const valuesClause = wikidataIds.map((id) => `wd:${id}`).join(" ");

  const query = `
    SELECT DISTINCT ?person ?personLabel ?position ?positionLabel ?startDate ?endDate ?constituency ?constituencyLabel ?ofLabel WHERE {
      VALUES ?person { ${valuesClause} }

      ?person p:P39 ?positionStatement .
      ?positionStatement ps:P39 ?position .

      OPTIONAL { ?positionStatement pq:P580 ?startDate }
      OPTIONAL { ?positionStatement pq:P582 ?endDate }
      OPTIONAL { ?positionStatement pq:P768 ?constituency }
      OPTIONAL { ?positionStatement pq:P642 ?of }

      SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en" }
    }
    ORDER BY ?personLabel ?startDate
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
 * Extract Wikidata Q-ID from URI
 */
function extractQId(uri: string): string {
  return uri.split("/").pop() || "";
}

/**
 * Parse Wikidata date to JavaScript Date
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
 * Get MandateType and institution from Wikidata position
 */
function getMandateInfo(positionQId: string): { type: MandateType; institution: string } | null {
  return POSITION_MAPPING[positionQId] || null;
}

/**
 * Generate title for mandate
 */
function generateTitle(
  positionLabel: string,
  constituencyLabel?: string,
  ofLabel?: string
): string {
  if (ofLabel && ofLabel !== positionLabel) {
    return `${positionLabel} de ${ofLabel}`;
  }
  if (constituencyLabel) {
    return `${positionLabel} (${constituencyLabel})`;
  }
  return positionLabel;
}

interface SyncResult {
  politiciansProcessed: number;
  mandatesCreated: number;
  mandatesSkipped: number;
  errors: string[];
}

/**
 * Main sync function
 */
async function syncCareers(options: { dryRun?: boolean } = {}): Promise<SyncResult> {
  const { dryRun = false } = options;

  const result: SyncResult = {
    politiciansProcessed: 0,
    mandatesCreated: 0,
    mandatesSkipped: 0,
    errors: [],
  };

  console.log("Fetching politicians with Wikidata IDs...");

  // Get all politicians with Wikidata IDs
  const externalIds = await db.externalId.findMany({
    where: {
      source: DataSource.WIKIDATA,
      politicianId: { not: null },
    },
    include: {
      politician: {
        include: {
          mandates: true,
        },
      },
    },
  });

  console.log(`Found ${externalIds.length} politicians with Wikidata IDs`);

  // Process in batches to avoid overloading Wikidata
  const BATCH_SIZE = 50;
  const batches = [];
  for (let i = 0; i < externalIds.length; i += BATCH_SIZE) {
    batches.push(externalIds.slice(i, i + BATCH_SIZE));
  }

  console.log(`Processing in ${batches.length} batches of ${BATCH_SIZE}...`);

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(`\nBatch ${batchIndex + 1}/${batches.length}...`);

    const wikidataIds = batch.map((e) => e.externalId);

    try {
      const positions = await fetchWikidataPositions(wikidataIds);
      console.log(`  Found ${positions.length} positions in Wikidata`);

      // Group positions by person
      const positionsByPerson = new Map<string, WikidataPositionResult[]>();
      for (const pos of positions) {
        const qId = extractQId(pos.person.value);
        if (!positionsByPerson.has(qId)) {
          positionsByPerson.set(qId, []);
        }
        positionsByPerson.get(qId)!.push(pos);
      }

      // Process each politician in the batch
      for (const extId of batch) {
        const politician = extId.politician;
        if (!politician) continue;

        result.politiciansProcessed++;
        const personPositions = positionsByPerson.get(extId.externalId) || [];

        for (const pos of personPositions) {
          const positionQId = extractQId(pos.position.value);
          const mandateInfo = getMandateInfo(positionQId);

          if (!mandateInfo) {
            // Unknown position type, skip
            continue;
          }

          const startDate = parseDate(pos.startDate?.value);
          const endDate = parseDate(pos.endDate?.value);

          // Skip if no start date (can't create a mandate without start date)
          if (!startDate) {
            continue;
          }

          const title = generateTitle(
            pos.positionLabel.value,
            pos.constituencyLabel?.value,
            pos.ofLabel?.value
          );

          // Check if mandate already exists (by type and approximate start date)
          const existingMandate = politician.mandates.find((m) => {
            if (m.type !== mandateInfo.type) return false;

            // Check if start dates are within 30 days of each other
            const existingStart = new Date(m.startDate);
            const diff = Math.abs(existingStart.getTime() - startDate.getTime());
            const daysDiff = diff / (1000 * 60 * 60 * 24);
            return daysDiff < 30;
          });

          if (existingMandate) {
            result.mandatesSkipped++;
            continue;
          }

          // Create new mandate
          if (dryRun) {
            console.log(`    [DRY-RUN] Would create: ${politician.fullName} - ${title}`);
            result.mandatesCreated++;
          } else {
            try {
              await db.mandate.create({
                data: {
                  politicianId: politician.id,
                  type: mandateInfo.type,
                  title,
                  institution: mandateInfo.institution,
                  constituency: pos.constituencyLabel?.value || null,
                  startDate,
                  endDate,
                  isCurrent: !endDate,
                  sourceUrl: `https://www.wikidata.org/wiki/${extId.externalId}`,
                  externalId: `wikidata-${extId.externalId}-${positionQId}-${startDate.toISOString().split("T")[0]}`,
                },
              });
              result.mandatesCreated++;
              console.log(`    Created: ${politician.fullName} - ${title}`);
            } catch (error) {
              result.errors.push(`${politician.fullName}: ${error}`);
            }
          }
        }
      }

      // Rate limiting - wait between batches
      if (batchIndex < batches.length - 1) {
        console.log("  Waiting 2s before next batch...");
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      result.errors.push(`Batch ${batchIndex + 1}: ${error}`);
      console.error(`  Error in batch ${batchIndex + 1}:`, error);
    }
  }

  return result;
}

/**
 * Show current stats
 */
async function showStats(): Promise<void> {
  const [totalPoliticians, withWikidata, totalMandates, mandatesByType] = await Promise.all([
    db.politician.count(),
    db.externalId.count({
      where: {
        source: DataSource.WIKIDATA,
        politicianId: { not: null },
      },
    }),
    db.mandate.count(),
    db.mandate.groupBy({
      by: ["type"],
      _count: true,
      orderBy: { _count: { type: "desc" } },
    }),
  ]);

  console.log("\n=".repeat(50));
  console.log("Career Sync Stats");
  console.log("=".repeat(50));
  console.log(`Total politicians: ${totalPoliticians}`);
  console.log(`With Wikidata ID: ${withWikidata} (${((withWikidata / totalPoliticians) * 100).toFixed(1)}%)`);
  console.log(`\nTotal mandates: ${totalMandates}`);
  console.log("\nMandates by type:");
  for (const { type, _count } of mandatesByType) {
    console.log(`  ${type}: ${_count}`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Politic Tracker - Career Sync from Wikidata

Usage:
  npx tsx scripts/sync-careers.ts              Sync careers for politicians with Wikidata IDs
  npx tsx scripts/sync-careers.ts --dry-run    Preview without saving
  npx tsx scripts/sync-careers.ts --stats      Show current stats
  npx tsx scripts/sync-careers.ts --help       Show this help

Data source: Wikidata property P39 (position held)
    `);
    process.exit(0);
  }

  if (args.includes("--stats")) {
    await showStats();
    process.exit(0);
  }

  const dryRun = args.includes("--dry-run");

  console.log("=".repeat(50));
  console.log("Politic Tracker - Career Sync from Wikidata");
  console.log("=".repeat(50));
  console.log(`Mode: ${dryRun ? "DRY RUN (no changes)" : "LIVE"}`);
  console.log(`Started at: ${new Date().toISOString()}\n`);

  const startTime = Date.now();
  const result = await syncCareers({ dryRun });
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("\n" + "=".repeat(50));
  console.log("Sync Results:");
  console.log("=".repeat(50));
  console.log(`Duration: ${duration}s`);
  console.log(`Politicians processed: ${result.politiciansProcessed}`);
  console.log(`Mandates created: ${result.mandatesCreated}`);
  console.log(`Mandates skipped (already exist): ${result.mandatesSkipped}`);

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
