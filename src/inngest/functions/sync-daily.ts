import { execSync } from "child_process";
import { inngest } from "../client";

const DAILY_STEPS = [
  { name: "votes-an", cmd: "npx tsx scripts/sync-votes-an.ts --today" },
  { name: "votes-senat", cmd: "npx tsx scripts/sync-votes-senat.ts --today" },
  { name: "legislation", cmd: "npx tsx scripts/sync-legislation.ts --active" },
  { name: "legislation-content", cmd: "npx tsx scripts/sync-legislation-content.ts --limit=20" },
  { name: "summaries-dossiers", cmd: "npx tsx scripts/generate-summaries.ts --limit=10" },
  { name: "summaries-scrutins", cmd: "npx tsx scripts/generate-scrutin-summaries.ts --limit=20" },
  { name: "press-rss", cmd: "npx tsx scripts/sync-press.ts" },
  { name: "press-analysis", cmd: "npx tsx scripts/sync-press-analysis.ts --limit=100" },
  { name: "judilibre", cmd: "npx tsx scripts/sync-judilibre.ts --limit=20" },
  { name: "reconcile-affairs", cmd: "npx tsx scripts/reconcile-affairs.ts --auto-merge" },
  { name: "factchecks", cmd: "npx tsx scripts/sync-factchecks.ts --limit=50" },
  { name: "classify-themes", cmd: "npx tsx scripts/classify-themes.ts --limit=30" },
  { name: "embeddings-factchecks", cmd: "npx tsx scripts/index-embeddings.ts --type=FACTCHECK" },
  { name: "embeddings-press", cmd: "npx tsx scripts/index-embeddings.ts --type=PRESS_ARTICLE" },
  { name: "prominence", cmd: "npx tsx scripts/recalculate-prominence.ts" },
  { name: "publication-status", cmd: "npx tsx scripts/assign-publication-status.ts" },
];

export const syncDaily = inngest.createFunction(
  {
    id: "sync-daily",
    retries: 0,
    concurrency: { limit: 1 },
  },
  // Cron disabled — GitHub Actions handles daily scheduling until Phase 2 migration
  { event: "sync/daily" },
  async ({ step }) => {
    const results: Array<{ name: string; success: boolean; error?: string }> = [];

    for (const s of DAILY_STEPS) {
      const result = await step.run(s.name, async () => {
        try {
          execSync(s.cmd, {
            stdio: "inherit",
            env: { ...process.env },
            timeout: 10 * 60 * 1000,
          });
          return { success: true as const };
        } catch (err) {
          // Don't throw — continue to next step (same behavior as current sync-daily.ts)
          return {
            success: false as const,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      });

      results.push({ name: s.name, ...result });
    }

    const failed = results.filter((r) => !r.success);
    return {
      total: results.length,
      succeeded: results.length - failed.length,
      failed: failed.length,
      failures: failed.map((f) => f.name),
    };
  }
);
