import { execSync } from "child_process";
import { inngest } from "../client";
import { markJobRunning, markJobCompleted, markJobFailed, updateJobProgress } from "../job-helper";

export const syncLegislation = inngest.createFunction(
  {
    id: "sync-legislation",
    retries: 2,
    concurrency: { limit: 1, key: '"sync-legislation"' },
  },
  { event: "sync/legislation" },
  async ({ event, step }) => {
    const jobId = event.data.jobId as string | undefined;
    if (jobId) await markJobRunning(jobId);

    try {
      await step.run("legislation", async () => {
        execSync("npx tsx scripts/sync-legislation.ts --active", {
          stdio: "inherit",
          env: { ...process.env },
          timeout: 5 * 60 * 1000,
        });
        if (jobId) await updateJobProgress(jobId, 50);
      });

      await step.run("legislation-content", async () => {
        execSync("npx tsx scripts/sync-legislation-content.ts --limit=20", {
          stdio: "inherit",
          env: { ...process.env },
          timeout: 5 * 60 * 1000,
        });
      });

      if (jobId)
        await markJobCompleted(jobId, {
          steps: ["legislation", "legislation-content"],
        });
    } catch (err) {
      if (jobId) {
        await markJobFailed(jobId, err instanceof Error ? err.message : String(err));
      }
      throw err;
    }
  }
);
