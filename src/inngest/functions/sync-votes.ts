import { execSync } from "child_process";
import { inngest } from "../client";
import { markJobRunning, markJobCompleted, markJobFailed, updateJobProgress } from "../job-helper";

export const syncVotes = inngest.createFunction(
  {
    id: "sync-votes",
    retries: 2,
    concurrency: { limit: 1, key: '"sync-votes"' },
  },
  { event: "sync/votes" },
  async ({ event, step }) => {
    const jobId = event.data.jobId as string | undefined;
    if (jobId) await markJobRunning(jobId);

    try {
      await step.run("votes-an", async () => {
        execSync("npx tsx scripts/sync-votes-an.ts --today", {
          stdio: "inherit",
          env: { ...process.env },
          timeout: 5 * 60 * 1000,
        });
        if (jobId) await updateJobProgress(jobId, 50);
      });

      await step.run("votes-senat", async () => {
        execSync("npx tsx scripts/sync-votes-senat.ts --today", {
          stdio: "inherit",
          env: { ...process.env },
          timeout: 5 * 60 * 1000,
        });
      });

      if (jobId)
        await markJobCompleted(jobId, {
          steps: ["votes-an", "votes-senat"],
        });
    } catch (err) {
      if (jobId) {
        await markJobFailed(jobId, err instanceof Error ? err.message : String(err));
      }
      throw err;
    }
  }
);
