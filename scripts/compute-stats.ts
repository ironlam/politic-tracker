/**
 * Pre-compute participation statistics for the /statistiques page.
 *
 * Usage:
 *   npm run sync:compute-stats              # Compute and save stats
 *   npm run sync:compute-stats -- --stats   # Show current snapshot info
 *   npm run sync:compute-stats -- --dry-run # Preview without saving
 *   npm run sync:compute-stats -- --verbose # Detailed output
 */

import "dotenv/config";
import { db } from "@/lib/db";
import { createCLI } from "@/lib/sync/cli-runner";
import type { SyncHandler, SyncOptions, SyncResult } from "@/lib/sync/types";
import { computeStats } from "@/services/sync/compute-stats";

const handler: SyncHandler = {
  name: "Compute Stats",
  description: "Pre-compute participation statistics for the /statistiques page",

  showHelp() {
    console.log("Pre-compute participation statistics.\n");
    console.log("Populates PoliticianParticipation and StatsSnapshot tables");
    console.log("for instant serving on the stats page.\n");
    console.log("Usage: npm run sync:compute-stats [options]");
  },

  async showStats() {
    const [politicianCount, snapshotCount, snapshots] = await Promise.all([
      db.politicianParticipation.count(),
      db.statsSnapshot.count(),
      db.statsSnapshot.findMany({
        select: { key: true, computedAt: true, durationMs: true },
        orderBy: { key: "asc" },
      }),
    ]);

    console.log(`\nPoliticianParticipation: ${politicianCount} rows`);
    console.log(`StatsSnapshot: ${snapshotCount} snapshots\n`);

    if (snapshots.length > 0) {
      console.log("Snapshots:");
      for (const s of snapshots) {
        console.log(
          `  ${s.key.padEnd(30)} computed: ${s.computedAt.toISOString().slice(0, 19)}  (${s.durationMs}ms)`
        );
      }
    } else {
      console.log("No snapshots yet. Run without --stats to compute.");
    }
  },

  async sync(options: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      const result = await computeStats({
        dryRun: options.dryRun,
        verbose: options.verbose,
      });

      return {
        success: true,
        duration: (Date.now() - startTime) / 1000,
        stats: {
          politicians: result.politicians,
          parties: result.parties,
          groups: result.groups,
          durationMs: result.durationMs,
        },
        errors,
      };
    } catch (error) {
      errors.push(String(error));
      return {
        success: false,
        duration: (Date.now() - startTime) / 1000,
        stats: {},
        errors,
      };
    }
  },
};

createCLI(handler);
