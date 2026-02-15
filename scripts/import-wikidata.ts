/**
 * CLI script to import politician convictions from Wikidata SPARQL
 *
 * Usage:
 *   npm run import:wikidata                      # Full import
 *   npm run import:wikidata -- --dry-run          # Preview without saving
 *   npm run import:wikidata -- --limit=10         # Limit to 10 results
 *   npm run import:wikidata -- --stats            # Show current stats
 *   npm run import:wikidata -- --help             # Show help
 */

import "dotenv/config";
import { createCLI, ProgressTracker, type SyncHandler, type SyncResult } from "../src/lib/sync";
import { db } from "../src/lib/db";
import {
  fetchWikidataConvictions,
  importConviction,
  getWikidataAffairsStats,
} from "../src/services/sync/wikidata-affairs";

const handler: SyncHandler = {
  name: "Politic Tracker - Wikidata Affairs Sync",
  description: "Imports politician convictions from Wikidata SPARQL",

  showHelp() {
    console.log(`
Politic Tracker - Wikidata Affairs Sync

This script:
  1. Queries Wikidata SPARQL for French politicians with convictions (P1399)
  2. Maps crime labels to AffairCategory (55+ mappings FR/EN)
  3. Creates/matches politicians by Wikidata ID or name
  4. Creates affairs with sources and party links

Source: https://query.wikidata.org/
    `);
  },

  async showStats() {
    const stats = await getWikidataAffairsStats();

    console.log("\n" + "=".repeat(50));
    console.log("Wikidata Affairs Stats");
    console.log("=".repeat(50));
    console.log(`Total Wikidata affairs: ${stats.totalAffairs}`);

    if (stats.topCategories.length > 0) {
      console.log("\nTop categories:");
      for (const { category, count } of stats.topCategories) {
        console.log(`  ${category}: ${count}`);
      }
    }

    if (stats.recentAffairs.length > 0) {
      console.log("\nRecent imports:");
      for (const { title, politicianName, createdAt } of stats.recentAffairs) {
        console.log(`  ${politicianName} - ${title} (${createdAt.toISOString().split("T")[0]})`);
      }
    }
  },

  async sync(options): Promise<SyncResult> {
    const { dryRun = false, limit } = options;

    const stats = {
      found: 0,
      imported: 0,
      skipped: 0,
      errors: 0,
    };
    const errors: string[] = [];

    // Step 1: Fetch convictions from Wikidata SPARQL
    console.log("Fetching convictions from Wikidata SPARQL...");
    const results = await fetchWikidataConvictions(limit as number | undefined);
    stats.found = results.length;
    console.log(`Found ${results.length} conviction records\n`);

    // Step 2: Load existing affair slugs
    const existingAffairs = await db.affair.findMany({ select: { slug: true } });
    const existingSlugs = new Set(existingAffairs.map((a) => a.slug));

    // Step 3: Process with progress tracking
    const progress = new ProgressTracker({
      total: results.length,
      label: "Importing convictions",
    });

    for (const result of results) {
      const outcome = await importConviction(result, existingSlugs, dryRun);

      if (outcome.imported) {
        stats.imported++;
      } else if (outcome.skipped) {
        stats.skipped++;
      }

      if (outcome.error) {
        stats.errors++;
        errors.push(outcome.error);
      }

      progress.update({
        processed: stats.imported + stats.skipped + stats.errors,
        created: stats.imported,
        skipped: stats.skipped,
        errors: stats.errors,
      });
      progress.tick();
    }

    progress.finish();

    return {
      success: errors.length === 0,
      duration: 0,
      stats,
      errors,
    };
  },
};

createCLI(handler);
