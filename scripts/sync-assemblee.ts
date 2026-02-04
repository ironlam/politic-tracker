/**
 * CLI script to sync deputies from data.gouv.fr
 *
 * Usage:
 *   npm run sync:assemblee              # Full sync
 *   npm run sync:assemblee -- --stats   # Show current stats
 */

import "dotenv/config";
import { createCLI, type SyncHandler, type SyncResult } from "../src/lib/sync";
import { syncDeputies, getSyncStats } from "../src/services/sync";

const handler: SyncHandler = {
  name: "Politic Tracker - Deputies Sync",
  description: "Import deputies from data.gouv.fr",

  showHelp() {
    console.log(`
Politic Tracker - Deputies Sync

Data source: data.gouv.fr (Datan dataset, updated daily)
    `);
  },

  async showStats() {
    const stats = await getSyncStats();
    console.log("\n" + "=".repeat(50));
    console.log("Database Stats");
    console.log("=".repeat(50));
    console.log(`Politicians: ${stats.politicians}`);
    console.log(`Parties: ${stats.parties}`);
    console.log(`Current mandates: ${stats.currentMandates}`);
  },

  async sync(options): Promise<SyncResult> {
    const { dryRun = false } = options;

    if (dryRun) {
      console.log("[DRY-RUN] Would sync deputies from data.gouv.fr");
      return { success: true, duration: 0, stats: {}, errors: [] };
    }

    const result = await syncDeputies();

    return {
      success: result.success,
      duration: 0,
      stats: {
        partiesCreated: result.partiesCreated,
        partiesUpdated: result.partiesUpdated,
        deputiesCreated: result.deputiesCreated,
        deputiesUpdated: result.deputiesUpdated,
      },
      errors: result.errors,
    };
  },
};

createCLI(handler);
