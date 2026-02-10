/**
 * CLI script to sync RNE (Répertoire National des Élus) maires
 *
 * Usage:
 *   npm run sync:rne:maires              # Full sync
 *   npm run sync:rne:maires -- --stats   # Show current stats
 *   npm run sync:rne:maires -- --dry-run # Preview without saving
 *   npm run sync:rne:maires -- --limit=100 --verbose # Test with 100 rows
 */

import "dotenv/config";
import { createCLI, type SyncHandler, type SyncResult } from "../src/lib/sync";
import { syncRNEMaires, getRNEStats } from "../src/services/sync/rne";

const handler: SyncHandler = {
  name: "Politic Tracker - RNE Maires Sync",
  description: "Import maires from Répertoire National des Élus (data.gouv.fr)",

  showHelp() {
    console.log(`
Politic Tracker - RNE Maires Sync

Data source: Répertoire National des Élus (data.gouv.fr)
Imports: Maires de France (~35 000)
Matching: Associates RNE data with existing politicians in our database
    `);
  },

  async showStats() {
    const stats = await getRNEStats();

    console.log("\n" + "=".repeat(50));
    console.log("RNE Maires Stats");
    console.log("=".repeat(50));
    console.log(`Current MAIRE mandates: ${stats.totalMaireMandates}`);
    console.log(`RNE external IDs: ${stats.totalRNEExternalIds}`);
  },

  async sync(options): Promise<SyncResult> {
    const { dryRun = false, limit, verbose = false } = options;

    const result = await syncRNEMaires({
      dryRun,
      limit: limit as number | undefined,
      verbose: verbose as boolean,
    });

    return {
      success: result.success,
      duration: 0,
      stats: {
        mandatesCreated: result.mandatesCreated,
        mandatesUpdated: result.mandatesUpdated,
        politiciansMatched: result.politiciansMatched,
        politiciansNotFound: result.politiciansNotFound,
      },
      errors: result.errors,
    };
  },
};

createCLI(handler);
