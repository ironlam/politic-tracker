/**
 * CLI script to sync parliamentary votes from NosDéputés.fr
 *
 * Usage:
 *   npx tsx scripts/sync-votes.ts              # Full sync (current legislature)
 *   npx tsx scripts/sync-votes.ts --leg=16     # Sync specific legislature
 *   npx tsx scripts/sync-votes.ts --stats      # Show current stats
 *   npx tsx scripts/sync-votes.ts --help       # Show help
 *
 * Rate limiting:
 *   - 500ms delay between each request (max 2 req/s)
 *   - Extra 2s pause every 20 requests
 *   - User-Agent identifies our app
 */

import "dotenv/config";
import { syncVotes, getVotesStats, ProgressCallback } from "../src/services/sync";

// Check if terminal supports interactive updates
const isTTY = process.stdout.isTTY === true;

// Progress bar rendering
function renderProgressBar(current: number, total: number, width: number = 30): string {
  const percent = Math.round((current / total) * 100);
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);
  return `[${bar}] ${percent}%`;
}

// Track last message length for proper clearing
let lastMessageLength = 0;

// Clear current line and write new content
function updateLine(message: string): void {
  if (isTTY) {
    // Use ANSI escape codes for better cross-platform support
    // \r = carriage return (go to start of line)
    // \x1b[K = clear from cursor to end of line
    process.stdout.write(`\r\x1b[K${message}`);
  } else {
    // Fallback: just overwrite with carriage return and spaces
    const padding = " ".repeat(Math.max(0, lastMessageLength - message.length));
    process.stdout.write(`\r${message}${padding}`);
  }
  lastMessageLength = message.length;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Transparence Politique - Votes Sync CLI

Usage:
  npx tsx scripts/sync-votes.ts              Full sync (legislature 16)
  npx tsx scripts/sync-votes.ts --leg=15     Sync specific legislature
  npx tsx scripts/sync-votes.ts --stats      Show current database stats
  npx tsx scripts/sync-votes.ts --help       Show this help message

Data source: NosDéputés.fr

Rate limiting:
  - 500ms delay between requests (max 2 req/s)
  - 2s pause every 20 requests
  - User-Agent: TransparencePolitique/1.0

Note: NosDéputés usually lags behind the current legislature.
      As of 2026, legislature 16 (2022-2024) is the latest available.
    `);
    process.exit(0);
  }

  if (args.includes("--stats")) {
    console.log("Fetching current votes stats...\n");
    const stats = await getVotesStats();
    console.log("Current database stats:");
    console.log(`  Scrutins: ${stats.scrutins}`);
    console.log(`  Total votes: ${stats.votes}`);

    if (stats.legislatures.length > 0) {
      console.log("\n  By legislature:");
      for (const leg of stats.legislatures) {
        console.log(`    - ${leg.legislature}e: ${leg.count} scrutins`);
      }
    }

    if (Object.keys(stats.byPosition).length > 0) {
      console.log("\n  By position:");
      for (const [position, count] of Object.entries(stats.byPosition)) {
        console.log(`    - ${position}: ${count}`);
      }
    }

    process.exit(0);
  }

  // Parse legislature option
  let legislature = 16; // Default to 16th (latest on NosDéputés)
  const legArg = args.find((a) => a.startsWith("--leg="));
  if (legArg) {
    legislature = parseInt(legArg.split("=")[1], 10);
    if (isNaN(legislature) || legislature < 1) {
      console.error("Invalid legislature number");
      process.exit(1);
    }
  }

  // Default: full sync
  console.log("=".repeat(50));
  console.log("Transparence Politique - Votes Sync");
  console.log("=".repeat(50));
  console.log(`Legislature: ${legislature}e`);
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log("");

  const startTime = Date.now();

  // Progress callback for real-time updates
  const onProgress: ProgressCallback = (current, total, message) => {
    const bar = renderProgressBar(current, total);
    updateLine(`${bar} ${message}`);
  };

  const result = await syncVotes(legislature, onProgress);

  // Clear progress line and show results
  console.log("\n");
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("=".repeat(50));
  console.log("Sync Results:");
  console.log("=".repeat(50));
  console.log(`Status: ${result.success ? "✅ SUCCESS" : "❌ FAILED"}`);
  console.log(`Duration: ${duration}s`);
  console.log(`\nScrutins:`);
  console.log(`  Created: ${result.scrutinsCreated}`);
  console.log(`  Updated: ${result.scrutinsUpdated}`);
  console.log(`\nVotes created: ${result.votesCreated}`);

  if (result.politiciansNotFound.length > 0) {
    console.log(`\nPoliticians not found (${result.politiciansNotFound.length}):`);
    result.politiciansNotFound.slice(0, 15).forEach((p) => console.log(`  - ${p}`));
    if (result.politiciansNotFound.length > 15) {
      console.log(`  ... and ${result.politiciansNotFound.length - 15} more`);
    }
  }

  if (result.errors.length > 0) {
    console.log(`\n⚠️  Errors (${result.errors.length}):`);
    result.errors.slice(0, 10).forEach((e) => console.log(`  - ${e}`));
    if (result.errors.length > 10) {
      console.log(`  ... and ${result.errors.length - 10} more`);
    }
  }

  console.log("\n" + "=".repeat(50));
  process.exit(result.success ? 0 : 1);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
