/**
 * CLI script to sync government members from data.gouv.fr
 *
 * Usage:
 *   npm run sync:gouvernement              # Sync current government only
 *   npm run sync:gouvernement -- --all     # Sync all historical governments
 *   npm run sync:gouvernement -- --stats   # Show current stats
 */

import "dotenv/config";
import { createCLI, type SyncHandler, type SyncResult } from "../src/lib/sync";
import { syncGovernment, getGovernmentStats, getSyncStats } from "../src/services/sync";

const handler: SyncHandler = {
  name: "Politic Tracker - Government Sync",
  description: "Import government members from data.gouv.fr",

  options: [
    {
      name: "--all",
      type: "boolean",
      description: "Sync all historical governments (Ve République)",
    },
  ],

  showHelp() {
    console.log(`
Politic Tracker - Government Sync

Data source: data.gouv.fr - Historique des Gouvernements de la Ve République
    `);
  },

  async showStats() {
    const [govStats, globalStats] = await Promise.all([getGovernmentStats(), getSyncStats()]);

    console.log("\n" + "=".repeat(50));
    console.log("Government Stats");
    console.log("=".repeat(50));
    console.log(`Total politicians: ${globalStats.politicians}`);
    console.log(`Total parties: ${globalStats.parties}`);
    console.log(`Current mandates: ${globalStats.currentMandates}`);
    console.log(`\nCurrent government members: ${govStats.currentGovernmentMembers}`);
    console.log(`Total government mandates: ${govStats.totalGovernmentMandates}`);
  },

  async sync(options): Promise<SyncResult> {
    const { dryRun = false, all = false } = options;

    if (dryRun) {
      console.log(`[DRY-RUN] Would sync ${all ? "all historical" : "current"} government`);
      return { success: true, duration: 0, stats: {}, errors: [] };
    }

    console.log(`Mode: ${all ? "All historical governments" : "Current government only"}`);

    const result = await syncGovernment({ currentOnly: !all });

    return {
      success: result.success,
      duration: 0,
      stats: {
        membersCreated: result.membersCreated,
        membersUpdated: result.membersUpdated,
        mandatesCreated: result.mandatesCreated,
      },
      errors: result.errors,
    };
  },
};

createCLI(handler);
