import { execSync } from "child_process";
import { inngest } from "../client";
import { markJobRunning, markJobCompleted, markJobFailed, updateJobProgress } from "../job-helper";

export const syncPress = inngest.createFunction(
  {
    id: "sync-press",
    retries: 2,
    concurrency: { limit: 1, key: '"sync-press"' },
  },
  { event: "sync/press" },
  async ({ event, step }) => {
    const jobId = event.data.jobId as string | undefined;
    if (jobId) await markJobRunning(jobId);

    try {
      // Step 1: Parse RSS feeds
      await step.run("parse-rss", async () => {
        execSync("npx tsx scripts/sync-press.ts", {
          stdio: "inherit",
          env: { ...process.env },
          timeout: 5 * 60 * 1000,
        });
        if (jobId) await updateJobProgress(jobId, 50);
      });

      // Step 2: AI analysis
      await step.run("ai-analysis", async () => {
        const limit = (event.data.limit as number) || 100;
        execSync(`npx tsx scripts/sync-press-analysis.ts --limit=${limit}`, {
          stdio: "inherit",
          env: { ...process.env },
          timeout: 10 * 60 * 1000,
        });
      });

      if (jobId)
        await markJobCompleted(jobId, {
          steps: ["parse-rss", "ai-analysis"],
        });
    } catch (err) {
      if (jobId) {
        await markJobFailed(jobId, err instanceof Error ? err.message : String(err));
      }
      throw err;
    }
  }
);
