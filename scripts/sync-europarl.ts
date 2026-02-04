/**
 * CLI script to sync MEPs from European Parliament
 *
 * Usage:
 *   npm run sync:europarl              # Full sync
 *   npm run sync:europarl -- --stats   # Show current stats
 */

import "dotenv/config";
import { createCLI, type SyncHandler, type SyncResult } from "../src/lib/sync";
import { syncEuroparl, getEuroparlStats } from "../src/services/sync";

const handler: SyncHandler = {
  name: "Politic Tracker - European Parliament Sync",
  description: "Import French MEPs from European Parliament",

  showHelp() {
    console.log(`
Politic Tracker - European Parliament MEPs Sync

Data source: European Parliament Open Data API (data.europarl.europa.eu)
    `);
  },

  async showStats() {
    const stats = await getEuroparlStats();

    console.log("\n" + "=".repeat(50));
    console.log("European Parliament Stats");
    console.log("=".repeat(50));
    console.log(`Total MEPs: ${stats.totalMEPs}`);
    console.log(`Total Groups: ${stats.totalGroups}`);
    console.log("\nBy political group:");
    for (const group of stats.byGroup) {
      console.log(`  ${group.code} (${group.name}): ${group.count}`);
    }
  },

  async sync(options): Promise<SyncResult> {
    const { dryRun = false } = options;

    if (dryRun) {
      console.log("[DRY-RUN] Would sync MEPs from European Parliament");
      return { success: true, duration: 0, stats: {}, errors: [] };
    }

    const result = await syncEuroparl();

    return {
      success: result.success,
      duration: 0,
      stats: {
        mepsCreated: result.mepsCreated,
        mepsUpdated: result.mepsUpdated,
        mandatesCreated: result.mandatesCreated,
        mandatesUpdated: result.mandatesUpdated,
      },
      errors: result.errors,
    };
  },
};

createCLI(handler);
