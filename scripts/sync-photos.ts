/**
 * CLI script to sync photos for politicians
 *
 * Usage:
 *   npx tsx scripts/sync-photos.ts              # Sync photos for politicians without photos
 *   npx tsx scripts/sync-photos.ts --validate   # Also validate existing photos
 *   npx tsx scripts/sync-photos.ts --stats      # Show current stats
 *   npx tsx scripts/sync-photos.ts --help       # Show help
 */

import "dotenv/config";
import { syncPhotos, getPhotoStats, getSyncStats } from "../src/services/sync";

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Politic Tracker - Photo Sync CLI

Usage:
  npx tsx scripts/sync-photos.ts              Sync photos for politicians without photos
  npx tsx scripts/sync-photos.ts --validate   Also validate existing photos and fix broken URLs
  npx tsx scripts/sync-photos.ts --stats      Show current photo statistics
  npx tsx scripts/sync-photos.ts --help       Show this help message

Photo sources (priority order):
  1. Assemblée nationale / Sénat (official photos)
  2. HATVP (official declarations)
  3. NosDéputés / NosSénateurs
  4. Wikidata
    `);
    process.exit(0);
  }

  if (args.includes("--stats")) {
    console.log("Fetching current stats...\n");
    const [photoStats, globalStats] = await Promise.all([
      getPhotoStats(),
      getSyncStats(),
    ]);
    console.log("Current database stats:");
    console.log(`  Total politicians: ${globalStats.politicians}`);
    console.log("");
    console.log("Photo stats:");
    console.log(`  With photo: ${photoStats.withPhoto}`);
    console.log(`  Without photo: ${photoStats.withoutPhoto}`);
    console.log(`  Coverage: ${((photoStats.withPhoto / photoStats.total) * 100).toFixed(1)}%`);
    console.log("\nBy source:");
    for (const [source, count] of Object.entries(photoStats.bySource)) {
      console.log(`  ${source}: ${count}`);
    }
    process.exit(0);
  }

  const validateExisting = args.includes("--validate");

  // Default: sync photos
  console.log("=".repeat(50));
  console.log("Politic Tracker - Photo Sync");
  console.log("=".repeat(50));
  console.log(`Mode: ${validateExisting ? "Validate existing + sync missing" : "Sync missing only"}`);
  console.log(`Started at: ${new Date().toISOString()}\n`);

  const startTime = Date.now();
  const result = await syncPhotos({ validateExisting });
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("\n" + "=".repeat(50));
  console.log("Sync Results:");
  console.log("=".repeat(50));
  console.log(`Status: ${result.success ? "SUCCESS" : "FAILED"}`);
  console.log(`Duration: ${duration}s`);
  console.log(`\nPhotos:`);
  console.log(`  Checked: ${result.checked}`);
  console.log(`  Updated: ${result.updated}`);
  if (validateExisting) {
    console.log(`  Validated: ${result.validated}`);
    console.log(`  Invalid URLs: ${result.invalidUrls}`);
  }

  if (result.errors.length > 0) {
    console.log(`\nErrors (${result.errors.length}):`);
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
