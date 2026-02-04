/**
 * CLI script to enrich politician careers from Wikidata
 *
 * Uses Wikidata API to get P39 (position held) for historical mandates.
 * Requires politicians to have Wikidata IDs (run sync-wikidata-ids first).
 *
 * Usage:
 *   npm run sync:careers              # Sync careers for all politicians
 *   npm run sync:careers -- --stats   # Show current stats
 *   npm run sync:careers -- --dry-run # Preview without saving
 *   npm run sync:careers -- --limit=50 # Process only 50 politicians
 *   npm run sync:careers -- --resume  # Resume from last checkpoint
 */

import "dotenv/config";
import {
  createCLI,
  ProgressTracker,
  CheckpointManager,
  type SyncHandler,
  type SyncResult,
} from "../src/lib/sync";
import { WikidataService } from "../src/lib/api";
import { parseDate } from "../src/lib/parsing";
import { db } from "../src/lib/db";
import { MandateType, DataSource } from "../src/generated/prisma";

// Mapping from Wikidata position IDs to our MandateType
const POSITION_MAPPING: Record<string, { type: MandateType; institution: string }> = {
  // National level - President & Government
  Q30461: { type: MandateType.PRESIDENT_REPUBLIQUE, institution: "Présidence de la République" },
  Q1587677: { type: MandateType.PREMIER_MINISTRE, institution: "Gouvernement" },
  Q83307: { type: MandateType.MINISTRE, institution: "Gouvernement" },
  Q26261727: { type: MandateType.SECRETAIRE_ETAT, institution: "Gouvernement" },

  // Deputies
  Q3044918: { type: MandateType.DEPUTE, institution: "Assemblée nationale" },
  Q21032547: { type: MandateType.DEPUTE, institution: "Assemblée nationale" },
  Q18941264: { type: MandateType.DEPUTE, institution: "Assemblée nationale" },
  Q55648587: { type: MandateType.DEPUTE, institution: "Assemblée nationale" },
  Q104728949: { type: MandateType.DEPUTE, institution: "Assemblée nationale" },

  // Senators
  Q3044923: { type: MandateType.SENATEUR, institution: "Sénat" },
  Q18558628: { type: MandateType.SENATEUR, institution: "Sénat" },

  // European Parliament
  Q27169: { type: MandateType.DEPUTE_EUROPEEN, institution: "Parlement européen" },
  Q2824658: { type: MandateType.DEPUTE_EUROPEEN, institution: "Parlement européen" },

  // Local level
  Q30185: { type: MandateType.MAIRE, institution: "Mairie" },
  Q382617: { type: MandateType.ADJOINT_MAIRE, institution: "Mairie" },
  Q19546: { type: MandateType.PRESIDENT_REGION, institution: "Conseil régional" },
  Q1805817: { type: MandateType.PRESIDENT_DEPARTEMENT, institution: "Conseil départemental" },
  Q1162444: { type: MandateType.CONSEILLER_REGIONAL, institution: "Conseil régional" },
  Q21032554: { type: MandateType.CONSEILLER_DEPARTEMENTAL, institution: "Conseil départemental" },
  Q17519573: { type: MandateType.CONSEILLER_MUNICIPAL, institution: "Conseil municipal" },
};

const handler: SyncHandler = {
  name: "Politic Tracker - Career Sync from Wikidata",
  description: "Enriches politician careers from Wikidata P39",

  options: [
    {
      name: "--resume",
      type: "boolean",
      description: "Resume from last checkpoint",
    },
  ],

  showHelp() {
    console.log(`
Politic Tracker - Career Sync from Wikidata

Requires: Run sync-wikidata-ids first to associate Wikidata IDs to politicians.
Data source: Wikidata property P39 (position held)

Features:
  - Checkpoint support: use --resume to continue after interruption
  - Uses WikidataService with retry and rate limiting
    `);
  },

  async showStats() {
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
    console.log(
      `With Wikidata ID: ${withWikidata} (${((withWikidata / totalPoliticians) * 100).toFixed(1)}%)`
    );
    console.log(`\nTotal mandates: ${totalMandates}`);
    console.log("\nMandates by type:");
    for (const { type, _count } of mandatesByType) {
      console.log(`  ${type}: ${_count}`);
    }
  },

  async sync(options): Promise<SyncResult> {
    const { dryRun = false, limit, resume = false } = options as {
      dryRun?: boolean;
      limit?: number;
      resume?: boolean;
    };

    const wikidata = new WikidataService({ rateLimitMs: 300 });
    const checkpoint = new CheckpointManager("sync-careers", { autoSaveInterval: 50 });

    const stats = {
      processed: 0,
      mandatesCreated: 0,
      mandatesSkipped: 0,
    };
    const errors: string[] = [];

    // Check for resume
    let startIndex = 0;
    if (resume && checkpoint.canResume()) {
      const resumeData = checkpoint.resume();
      if (resumeData) {
        startIndex = (resumeData.fromIndex ?? 0) + 1;
        stats.processed = resumeData.processedCount;
        console.log(`Resuming from index ${startIndex}\n`);
      }
    } else {
      checkpoint.start();
    }

    console.log("Fetching politicians with Wikidata IDs...");

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

    if (externalIds.length === 0) {
      checkpoint.complete();
      return { success: true, duration: 0, stats, errors };
    }

    const progress = new ProgressTracker({
      total: externalIds.length,
      label: "Syncing careers",
      showBar: true,
      showETA: true,
      logInterval: 25,
    });

    // Collect all Wikidata IDs for batch fetching
    const wikidataIds = externalIds
      .slice(startIndex)
      .map((e) => e.externalId)
      .filter(Boolean);

    // Fetch all positions in batch
    console.log("Fetching positions from Wikidata...");
    const positionsMap = await wikidata.getPositions(wikidataIds);
    console.log(`Fetched positions for ${positionsMap.size} entities\n`);

    // Collect all position/location IDs for label fetching
    const labelIds = new Set<string>();
    positionsMap.forEach((positions) => {
      for (const pos of positions) {
        labelIds.add(pos.positionId);
      }
    });

    // Fetch labels
    console.log(`Fetching labels for ${labelIds.size} entities...`);
    const labelsEntities = await wikidata.getEntities(Array.from(labelIds), ["labels"]);
    const labels = new Map<string, string>();
    labelsEntities.forEach((entity, id) => {
      const label = entity.labels.fr || entity.labels.en;
      if (label) labels.set(id, label);
    });
    console.log(`Fetched ${labels.size} labels\n`);

    // Process each politician
    for (let i = startIndex; i < externalIds.length; i++) {
      const extId = externalIds[i];
      const politician = extId.politician;
      if (!politician) {
        progress.tick();
        continue;
      }

      stats.processed++;

      const positions = positionsMap.get(extId.externalId) || [];

      for (const pos of positions) {
        const mandateInfo = POSITION_MAPPING[pos.positionId];
        if (!mandateInfo) continue;

        const startDate = pos.startDate;
        const endDate = pos.endDate;

        if (!startDate) continue;

        // Generate title
        const positionLabel = labels.get(pos.positionId) || pos.positionId;
        const title = positionLabel;

        // Check if mandate already exists (within 30 days of start date)
        const existingMandate = politician.mandates.find((m) => {
          if (m.type !== mandateInfo.type) return false;
          if (!m.startDate) return false;
          const existingStart = new Date(m.startDate);
          const diff = Math.abs(existingStart.getTime() - startDate.getTime());
          return diff / (1000 * 60 * 60 * 24) < 30;
        });

        if (existingMandate) {
          stats.mandatesSkipped++;
          continue;
        }

        const externalMandateId = `wikidata-${extId.externalId}-${pos.positionId}-${startDate.toISOString().split("T")[0]}`;

        if (dryRun) {
          console.log(
            `[DRY-RUN] ${politician.fullName} - ${title} (${startDate.getFullYear()})`
          );
          stats.mandatesCreated++;
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
            stats.mandatesCreated++;
          } catch (error) {
            errors.push(`${politician.fullName}: ${error}`);
          }
        }
      }

      progress.tick();
      checkpoint.tick(extId.externalId, i);
    }

    progress.finish();
    checkpoint.complete();

    return {
      success: errors.length === 0,
      duration: 0,
      stats,
      errors,
    };
  },
};

createCLI(handler);
