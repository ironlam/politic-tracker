/**
 * CLI script to sync HATVP declarations
 *
 * Usage:
 *   npm run sync:hatvp              # Full sync
 *   npm run sync:hatvp -- --stats   # Show current stats
 */

import "dotenv/config";
import { createCLI, type SyncHandler, type SyncResult } from "../src/lib/sync";
import { syncHATVP, getHATVPStats, getSyncStats } from "../src/services/sync";

const handler: SyncHandler = {
  name: "Politic Tracker - HATVP Sync",
  description: "Import HATVP declarations",

  showHelp() {
    console.log(`
Politic Tracker - HATVP Declarations Sync

Data source: HATVP Open Data (hatvp.fr)
Imports: Déclarations de patrimoine et d'intérêts
    `);
  },

  async showStats() {
    const [hatvpStats, globalStats] = await Promise.all([getHATVPStats(), getSyncStats()]);

    console.log("\n" + "=".repeat(50));
    console.log("HATVP Stats");
    console.log("=".repeat(50));
    console.log(`Total politicians: ${globalStats.politicians}`);
    console.log(`Total parties: ${globalStats.parties}`);
    console.log(`Current mandates: ${globalStats.currentMandates}`);
    console.log(`\nTotal declarations: ${hatvpStats.totalDeclarations}`);
    console.log(`Politicians with declarations: ${hatvpStats.politiciansWithDeclarations}`);
  },

  async sync(options): Promise<SyncResult> {
    const { dryRun = false } = options;

    if (dryRun) {
      console.log("[DRY-RUN] Would sync HATVP declarations");
      return { success: true, duration: 0, stats: {}, errors: [] };
    }

    const result = await syncHATVP();

    return {
      success: result.success,
      duration: 0,
      stats: {
        declarationsCreated: result.declarationsCreated,
        declarationsUpdated: result.declarationsUpdated,
        politiciansMatched: result.politiciansMatched,
        politiciansNotFound: result.politiciansNotFound,
      },
      errors: result.errors,
    };
  },
};

createCLI(handler);
