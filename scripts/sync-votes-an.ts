/**
 * CLI script to sync parliamentary votes from data.assemblee-nationale.fr
 *
 * Usage:
 *   npm run sync:votes-an              # Full sync (17th legislature)
 *   npm run sync:votes-an -- --leg=17  # Sync specific legislature
 *   npm run sync:votes-an -- --today   # Only process today's scrutins
 *   npm run sync:votes-an -- --stats   # Show current stats
 *
 * Data source: data.assemblee-nationale.fr (official Open Data)
 */

import "dotenv/config";
import { createCLI, type SyncHandler, type SyncResult } from "../src/lib/sync";
import { syncVotesAN, getVotesANStats } from "../src/services/sync/votes-an";

const DEFAULT_LEGISLATURE = 17;

const handler: SyncHandler = {
  name: "Politic Tracker - AN Votes Sync",
  description: "Import scrutins and votes from Assemblée nationale",

  options: [
    {
      name: "--leg",
      type: "string",
      description: `Legislature number (default: ${DEFAULT_LEGISLATURE})`,
    },
    {
      name: "--today",
      type: "boolean",
      description: "Only process scrutins from today's date",
    },
  ],

  showHelp() {
    console.log(`
Politic Tracker - Votes Sync (Assemblée Nationale)

Data source: data.assemblee-nationale.fr (official Open Data)

Features:
  - Downloads official ZIP file with all scrutins
  - Matches deputies by their AN acteur ID (ExternalId)
  - Creates/updates Scrutin and Vote records
    `);
  },

  async showStats() {
    const stats = await getVotesANStats();

    console.log("\n" + "=".repeat(50));
    console.log("AN Votes Stats");
    console.log("=".repeat(50));
    console.log(`Scrutins (AN): ${stats.scrutinsCount}`);
    console.log(`Total votes: ${stats.votesCount}`);

    if (stats.legislatures.length > 0) {
      console.log("\nBy legislature:");
      for (const leg of stats.legislatures) {
        console.log(`  ${leg.legislature}e: ${leg.count} scrutins`);
      }
    }
  },

  async sync(options): Promise<SyncResult> {
    const {
      dryRun = false,
      force = false,
      leg,
      today = false,
    } = options as {
      dryRun?: boolean;
      force?: boolean;
      leg?: string;
      today?: boolean;
    };

    const legislature = leg ? parseInt(leg, 10) : DEFAULT_LEGISLATURE;
    if (isNaN(legislature) || legislature < 1) {
      return {
        success: false,
        duration: 0,
        stats: {},
        errors: ["Invalid legislature number"],
      };
    }

    console.log(`Legislature: ${legislature}e`);
    if (today) console.log("Filter: Today's scrutins only");
    if (force) console.log("Mode: Full sync (--force)");

    const result = await syncVotesAN(legislature, dryRun, today, force);

    return {
      success: result.errors.length === 0,
      duration: 0,
      stats: {
        processed: result.scrutinsProcessed,
        created: result.scrutinsCreated,
        updated: result.scrutinsUpdated,
        skipped: result.scrutinsSkipped,
        votesCreated: result.votesCreated,
        votesSkipped: result.votesSkipped,
        politiciansNotFound: result.politiciansNotFound.size,
      },
      errors: result.errors,
    };
  },
};

createCLI(handler);
