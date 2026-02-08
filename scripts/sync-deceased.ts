/**
 * CLI script to sync death dates from Wikidata
 *
 * Usage:
 *   npm run sync:deceased              # Sync death dates
 *   npm run sync:deceased -- --stats   # Show current stats
 *   npm run sync:deceased -- --help    # Show help
 */

import "dotenv/config";
import { createCLI, type SyncHandler, type SyncResult } from "../src/lib/sync";
import {
  syncDeceasedFromWikidata,
  updateDeceasedMandates,
  getDeceasedStats,
} from "../src/services/sync/deceased";
import { getSyncStats } from "../src/services/sync";

const handler: SyncHandler = {
  name: "Politic Tracker - Deceased Sync",
  description: "Sync death dates from Wikidata",

  showHelp() {
    console.log(`
Politic Tracker - Deceased Sync

This script:
  1. Fetches death dates from Wikidata for politicians with Wikidata IDs
  2. Marks mandates as not current for deceased politicians
    `);
  },

  async showStats() {
    const [deceasedStats, globalStats] = await Promise.all([getDeceasedStats(), getSyncStats()]);

    console.log("\n" + "=".repeat(50));
    console.log("Deceased Stats");
    console.log("=".repeat(50));
    console.log(`Total politicians: ${globalStats.politicians}`);
    console.log(`Deceased: ${deceasedStats.deceased}`);
    console.log(`Alive/Unknown: ${deceasedStats.alive}`);
    console.log(`Deceased with 'current' mandate: ${deceasedStats.deceasedWithCurrentMandate}`);
  },

  async sync(options): Promise<SyncResult> {
    const { dryRun = false } = options;

    const stats = {
      checked: 0,
      deathDatesUpdated: 0,
      mandatesUpdated: 0,
    };
    const errors: string[] = [];

    if (dryRun) {
      console.log("[DRY-RUN] Would sync death dates from Wikidata");
      console.log("[DRY-RUN] Would update mandates for deceased politicians");
      return { success: true, duration: 0, stats, errors };
    }

    try {
      // Step 1: Sync death dates from Wikidata
      const result = await syncDeceasedFromWikidata();
      stats.checked = result.checked;
      stats.deathDatesUpdated = result.updated;
      errors.push(...result.errors);

      // Step 2: Update mandates for deceased politicians
      console.log("\nUpdating mandates for deceased politicians...");
      stats.mandatesUpdated = await updateDeceasedMandates();

      return {
        success: result.success,
        duration: 0,
        stats,
        errors,
      };
    } catch (error) {
      errors.push(String(error));
      return {
        success: false,
        duration: 0,
        stats,
        errors,
      };
    }
  },
};

createCLI(handler);
