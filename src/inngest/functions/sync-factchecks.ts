import { execSync } from "child_process";
import { inngest } from "../client";
import { markJobRunning, markJobCompleted, markJobFailed, updateJobProgress } from "../job-helper";

export const syncFactchecks = inngest.createFunction(
  {
    id: "sync-factchecks",
    retries: 2,
    concurrency: { limit: 1, key: '"sync-factchecks"' },
  },
  { event: "sync/factchecks" },
  async ({ event, step }) => {
    const jobId = event.data.jobId as string | undefined;
    if (jobId) await markJobRunning(jobId);

    try {
      await step.run("factchecks", async () => {
        execSync("npx tsx scripts/sync-factchecks.ts --limit=50", {
          stdio: "inherit",
          env: { ...process.env },
          timeout: 5 * 60 * 1000,
        });
        if (jobId) await updateJobProgress(jobId, 50);
      });

      await step.run("judilibre", async () => {
        execSync("npx tsx scripts/sync-judilibre.ts --limit=20", {
          stdio: "inherit",
          env: { ...process.env },
          timeout: 5 * 60 * 1000,
        });
      });

      if (jobId)
        await markJobCompleted(jobId, {
          steps: ["factchecks", "judilibre"],
        });
    } catch (err) {
      if (jobId) {
        await markJobFailed(jobId, err instanceof Error ? err.message : String(err));
      }
      throw err;
    }
  }
);
