/**
 * CLI script to sync affairs from Judilibre (Cour de cassation via PISTE)
 *
 * Searches criminal decisions by politician name, enriches existing affairs
 * with ECLI/pourvoi identifiers, and creates new affairs for confirmed convictions.
 *
 * Usage:
 *   npm run sync:judilibre                          # Sync all politicians
 *   npm run sync:judilibre -- --stats               # Show current stats
 *   npm run sync:judilibre -- --dry-run             # Preview without saving
 *   npm run sync:judilibre -- --limit=10            # Limit to N politicians
 *   npm run sync:judilibre -- --politician=slug     # Single politician
 *   npm run sync:judilibre -- --force               # Ignore min sync interval
 */

import "dotenv/config";
import { createCLI, type SyncHandler, type SyncResult } from "../src/lib/sync";
import { syncJudilibre, getJudilibreStats } from "../src/services/sync/judilibre";

const handler: SyncHandler = {
  name: "Poligraph - Judilibre Sync (Cour de cassation)",
  description: "Syncs criminal decisions from Judilibre API via PISTE OAuth 2.0",

  options: [
    {
      name: "--politician",
      type: "string",
      description: "Sync a single politician by slug",
    },
  ],

  showHelp() {
    console.log(`
Poligraph - Judilibre Sync (Cour de cassation)

Searches the Judilibre API (Cour de cassation) for criminal decisions
mentioning French politicians. Enriches existing affairs with judicial
identifiers (ECLI, pourvoi) and creates new affairs for confirmed convictions.

New affairs are prefixed [À VÉRIFIER] and require manual validation.

Options:
  --stats              Show current statistics
  --dry-run            Preview changes without saving
  --limit=N            Limit to N politicians
  --politician=slug    Sync a specific politician by slug
  --force              Ignore minimum sync interval (24h)
  --verbose            Show detailed output
  --help               Show this help message

Environment:
  JUDILIBRE_CLIENT_ID      Required. PISTE OAuth client ID
  JUDILIBRE_CLIENT_SECRET  Required. PISTE OAuth client secret
  JUDILIBRE_BASE_URL       Judilibre API base URL
  JUDILIBRE_OAUTH_URL      PISTE OAuth token endpoint
    `);
  },

  async showStats() {
    await getJudilibreStats();
  },

  async sync(options): Promise<SyncResult> {
    const {
      dryRun = false,
      force = false,
      limit,
      politician: politicianSlug,
      verbose = false,
    } = options as {
      dryRun?: boolean;
      force?: boolean;
      limit?: number;
      politician?: string;
      verbose?: boolean;
    };

    const stats = await syncJudilibre({
      dryRun,
      force,
      limit,
      politicianSlug,
      verbose,
    });

    return {
      success: stats.errors === 0,
      duration: 0,
      stats: {
        politiciansSearched: stats.politiciansSearched,
        decisionsFound: stats.decisionsFound,
        decisionsRelevant: stats.decisionsRelevant,
        affairsEnriched: stats.affairsEnriched,
        affairsCreated: stats.affairsCreated,
        decisionsSkipped: stats.decisionsSkipped,
        errors: stats.errors,
      },
      errors: [],
    };
  },
};

createCLI(handler);
