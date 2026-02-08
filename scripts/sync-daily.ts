/**
 * Daily sync orchestrator
 *
 * Runs incremental syncs for votes (AN + Sénat) and legislation,
 * then downloads new exposés des motifs and generates AI summaries.
 *
 * Usage:
 *   npm run sync:daily              # Run all daily sync steps
 *   npm run sync:daily -- --dry-run # Preview without writing to DB
 *
 * Designed to run 3x/day via GitHub Actions (6h, 12h, 20h Paris time).
 * Each step uses --today to only process new items from the current day.
 */

import "dotenv/config";
import { execSync } from "child_process";

const DRY_RUN = process.argv.includes("--dry-run");
const dryRunFlag = DRY_RUN ? " --dry-run" : "";

interface SyncStep {
  name: string;
  command: string;
}

const steps: SyncStep[] = [
  {
    name: "Votes AN (today)",
    command: `npx tsx scripts/sync-votes-an.ts --today${dryRunFlag}`,
  },
  {
    name: "Votes Sénat (today)",
    command: `npx tsx scripts/sync-votes-senat.ts --today${dryRunFlag}`,
  },
  {
    name: "Législation (today, active)",
    command: `npx tsx scripts/sync-legislation.ts --today --active${dryRunFlag}`,
  },
  {
    name: "Exposés des motifs (limit 20)",
    command: `npx tsx scripts/sync-legislation-content.ts --limit=20${dryRunFlag}`,
  },
  {
    name: "Résumés IA dossiers (limit 10)",
    command: `npx tsx scripts/generate-summaries.ts --limit=10${dryRunFlag}`,
  },
  {
    name: "Résumés IA scrutins (limit 20)",
    command: `npx tsx scripts/generate-scrutin-summaries.ts --limit=20${dryRunFlag}`,
  },
];

async function main() {
  const startTime = Date.now();
  const today = new Date().toISOString().split("T")[0];

  console.log("=".repeat(60));
  console.log(`Daily Sync — ${today}`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log("=".repeat(60));
  console.log("");

  const results: { name: string; success: boolean; duration: number; error?: string }[] = [];

  for (const step of steps) {
    const stepStart = Date.now();
    console.log(`\n${"─".repeat(50)}`);
    console.log(`▶ ${step.name}`);
    console.log(`  ${step.command}`);
    console.log("─".repeat(50));

    try {
      execSync(step.command, {
        stdio: "inherit",
        env: { ...process.env },
        timeout: 10 * 60 * 1000, // 10 minutes max per step
      });

      const duration = (Date.now() - stepStart) / 1000;
      results.push({ name: step.name, success: true, duration });
      console.log(`\n✓ ${step.name} completed in ${duration.toFixed(1)}s`);
    } catch (err) {
      const duration = (Date.now() - stepStart) / 1000;
      const errorMsg = err instanceof Error ? err.message : String(err);
      results.push({ name: step.name, success: false, duration, error: errorMsg });
      console.error(`\n✗ ${step.name} failed after ${duration.toFixed(1)}s: ${errorMsg}`);
      // Continue to next step even on failure
    }
  }

  // Summary
  const totalDuration = (Date.now() - startTime) / 1000;
  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log("\n" + "=".repeat(60));
  console.log("Daily Sync Summary");
  console.log("=".repeat(60));
  console.log(`Total duration: ${totalDuration.toFixed(1)}s`);
  console.log(`Steps: ${succeeded} succeeded, ${failed} failed\n`);

  for (const r of results) {
    const icon = r.success ? "✓" : "✗";
    const time = `${r.duration.toFixed(1)}s`;
    console.log(`  ${icon} ${r.name} (${time})${r.error ? ` — ${r.error}` : ""}`);
  }

  console.log("");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
