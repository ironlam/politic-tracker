/**
 * CLI script to enrich politician careers from Wikidata
 *
 * Uses Wikidata API to get P39 (position held) for historical mandates.
 * Requires politicians to have Wikidata IDs (run sync-wikidata-ids first).
 *
 * Usage:
 *   npx tsx scripts/sync-careers.ts              # Sync careers for all politicians with Wikidata IDs
 *   npx tsx scripts/sync-careers.ts --stats      # Show current stats
 *   npx tsx scripts/sync-careers.ts --dry-run    # Preview without saving
 *   npx tsx scripts/sync-careers.ts --limit=50   # Process only 50 politicians
 */

import "dotenv/config";
import { db } from "../src/lib/db";
import { MandateType, DataSource } from "../src/generated/prisma";

const WIKIDATA_API = "https://www.wikidata.org/w/api.php";

// Rate limiting
const DELAY_BETWEEN_REQUESTS_MS = 300;

// Mapping from Wikidata position IDs to our MandateType
const POSITION_MAPPING: Record<string, { type: MandateType; institution: string }> = {
  // National level - President & Government
  "Q30461": { type: MandateType.PRESIDENT_REPUBLIQUE, institution: "Présidence de la République" },
  "Q1587677": { type: MandateType.PREMIER_MINISTRE, institution: "Gouvernement" },
  "Q83307": { type: MandateType.MINISTRE, institution: "Gouvernement" },
  "Q26261727": { type: MandateType.SECRETAIRE_ETAT, institution: "Gouvernement" },

  // Deputies (various Q-IDs used in Wikidata)
  "Q3044918": { type: MandateType.DEPUTE, institution: "Assemblée nationale" },
  "Q21032547": { type: MandateType.DEPUTE, institution: "Assemblée nationale" },
  "Q18941264": { type: MandateType.DEPUTE, institution: "Assemblée nationale" }, // XVIe
  "Q55648587": { type: MandateType.DEPUTE, institution: "Assemblée nationale" }, // XVIIe
  "Q104728949": { type: MandateType.DEPUTE, institution: "Assemblée nationale" },

  // Senators
  "Q3044923": { type: MandateType.SENATEUR, institution: "Sénat" },
  "Q18558628": { type: MandateType.SENATEUR, institution: "Sénat" },

  // European Parliament
  "Q27169": { type: MandateType.DEPUTE_EUROPEEN, institution: "Parlement européen" },
  "Q2824658": { type: MandateType.DEPUTE_EUROPEEN, institution: "Parlement européen" },

  // Local level
  "Q30185": { type: MandateType.MAIRE, institution: "Mairie" },
  "Q382617": { type: MandateType.ADJOINT_MAIRE, institution: "Mairie" },
  "Q19546": { type: MandateType.PRESIDENT_REGION, institution: "Conseil régional" },
  "Q1805817": { type: MandateType.PRESIDENT_DEPARTEMENT, institution: "Conseil départemental" },
  "Q1162444": { type: MandateType.CONSEILLER_REGIONAL, institution: "Conseil régional" },
  "Q21032554": { type: MandateType.CONSEILLER_DEPARTEMENTAL, institution: "Conseil départemental" },
  "Q17519573": { type: MandateType.CONSEILLER_MUNICIPAL, institution: "Conseil municipal" },
};

interface PositionClaim {
  positionId: string;
  positionLabel?: string;
  startDate?: string;
  endDate?: string;
  ofId?: string;
  ofLabel?: string;
  constituencyLabel?: string;
}

/**
 * Fetch P39 (position held) claims for a Wikidata entity using REST API
 */
async function fetchPositions(wikidataId: string): Promise<PositionClaim[]> {
  const url = new URL(WIKIDATA_API);
  url.searchParams.set("action", "wbgetentities");
  url.searchParams.set("ids", wikidataId);
  url.searchParams.set("props", "claims");
  url.searchParams.set("format", "json");

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": "TransparencePolitique/1.0 (https://politic-tracker.vercel.app)",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Wikidata API failed: ${response.status}`);
  }

  const data = await response.json();
  const entity = data.entities?.[wikidataId];

  if (!entity?.claims?.P39) {
    return [];
  }

  const positions: PositionClaim[] = [];

  for (const claim of entity.claims.P39) {
    const positionId = claim.mainsnak?.datavalue?.value?.id;
    if (!positionId) continue;

    const position: PositionClaim = { positionId };

    // Get qualifiers
    const qualifiers = claim.qualifiers || {};

    // P580 = start date
    if (qualifiers.P580?.[0]?.datavalue?.value?.time) {
      position.startDate = qualifiers.P580[0].datavalue.value.time
        .replace(/^\+/, "")
        .split("T")[0];
    }

    // P582 = end date
    if (qualifiers.P582?.[0]?.datavalue?.value?.time) {
      position.endDate = qualifiers.P582[0].datavalue.value.time
        .replace(/^\+/, "")
        .split("T")[0];
    }

    // P642 = "of" (e.g., Mayor OF Paris)
    if (qualifiers.P642?.[0]?.datavalue?.value?.id) {
      position.ofId = qualifiers.P642[0].datavalue.value.id;
    }

    // P768 = electoral district
    if (qualifiers.P768?.[0]?.datavalue?.value?.id) {
      // We'll fetch labels separately if needed
    }

    positions.push(position);
  }

  return positions;
}

/**
 * Fetch labels for position IDs
 */
async function fetchLabels(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();

  const url = new URL(WIKIDATA_API);
  url.searchParams.set("action", "wbgetentities");
  url.searchParams.set("ids", ids.join("|"));
  url.searchParams.set("props", "labels");
  url.searchParams.set("languages", "fr|en");
  url.searchParams.set("format", "json");

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": "TransparencePolitique/1.0 (https://politic-tracker.vercel.app)",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    return new Map();
  }

  const data = await response.json();
  const labels = new Map<string, string>();

  for (const id of ids) {
    const entity = data.entities?.[id];
    const label = entity?.labels?.fr?.value || entity?.labels?.en?.value;
    if (label) {
      labels.set(id, label);
    }
  }

  return labels;
}

/**
 * Parse date string to Date object
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
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
async function syncCareers(options: { dryRun?: boolean; limit?: number } = {}): Promise<SyncResult> {
  const { dryRun = false, limit } = options;

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
    take: limit,
  });

  console.log(`Found ${externalIds.length} politicians with Wikidata IDs\n`);

  // Process one by one
  for (let i = 0; i < externalIds.length; i++) {
    const extId = externalIds[i];
    const politician = extId.politician;
    if (!politician) continue;

    result.politiciansProcessed++;

    try {
      // Fetch positions from Wikidata
      const positions = await fetchPositions(extId.externalId);

      if (positions.length === 0) {
        continue;
      }

      // Collect all position IDs and "of" IDs for label fetching
      const idsToFetch = new Set<string>();
      for (const pos of positions) {
        idsToFetch.add(pos.positionId);
        if (pos.ofId) idsToFetch.add(pos.ofId);
      }

      // Fetch labels
      const labels = await fetchLabels([...idsToFetch]);

      // Process each position
      for (const pos of positions) {
        const mandateInfo = POSITION_MAPPING[pos.positionId];

        if (!mandateInfo) {
          // Unknown position type, skip
          continue;
        }

        const startDate = parseDate(pos.startDate);
        const endDate = parseDate(pos.endDate);

        // Skip if no start date
        if (!startDate) {
          continue;
        }

        // Generate title
        const positionLabel = labels.get(pos.positionId) || pos.positionId;
        const ofLabel = pos.ofId ? labels.get(pos.ofId) : undefined;

        let title = positionLabel;
        if (ofLabel && ofLabel !== positionLabel) {
          title = `${positionLabel} de ${ofLabel}`;
        }

        // Check if mandate already exists
        const existingMandate = politician.mandates.find((m) => {
          if (m.type !== mandateInfo.type) return false;
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
        const externalMandateId = `wikidata-${extId.externalId}-${pos.positionId}-${startDate.toISOString().split("T")[0]}`;

        if (dryRun) {
          console.log(`[DRY-RUN] ${politician.fullName} - ${title} (${startDate.getFullYear()})`);
          result.mandatesCreated++;
        } else {
          try {
            await db.mandate.create({
              data: {
                politicianId: politician.id,
                type: mandateInfo.type,
                title,
                institution: mandateInfo.institution,
                startDate,
                endDate,
                isCurrent: !endDate,
                sourceUrl: `https://www.wikidata.org/wiki/${extId.externalId}`,
                externalId: externalMandateId,
              },
            });
            result.mandatesCreated++;
            console.log(`✓ ${politician.fullName} - ${title} (${startDate.getFullYear()})`);
          } catch (error) {
            result.errors.push(`${politician.fullName}: ${error}`);
          }
        }
      }
    } catch (error) {
      result.errors.push(`${politician.fullName}: ${error}`);
    }

    // Progress every 50
    if ((i + 1) % 50 === 0) {
      const progress = (((i + 1) / externalIds.length) * 100).toFixed(0);
      console.log(`\n--- Progress: ${progress}% (${i + 1}/${externalIds.length}) | Created: ${result.mandatesCreated} ---\n`);
    }

    // Rate limiting
    await sleep(DELAY_BETWEEN_REQUESTS_MS);
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

  console.log("\n" + "=".repeat(50));
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
  npx tsx scripts/sync-careers.ts --limit=50   Process only first 50 politicians
  npx tsx scripts/sync-careers.ts --stats      Show current stats
  npx tsx scripts/sync-careers.ts --help       Show this help

Requires: Run sync-wikidata-ids first to associate Wikidata IDs to politicians.
Data source: Wikidata property P39 (position held)
    `);
    process.exit(0);
  }

  if (args.includes("--stats")) {
    await showStats();
    process.exit(0);
  }

  const dryRun = args.includes("--dry-run");
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : undefined;

  console.log("=".repeat(50));
  console.log("Politic Tracker - Career Sync from Wikidata");
  console.log("=".repeat(50));
  console.log(`Mode: ${dryRun ? "DRY RUN (no changes)" : "LIVE"}`);
  if (limit) console.log(`Limit: ${limit} politicians`);
  console.log(`Started at: ${new Date().toISOString()}\n`);

  const startTime = Date.now();
  const result = await syncCareers({ dryRun, limit });
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
