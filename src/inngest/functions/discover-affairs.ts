import { execSync } from "child_process";
import { inngest } from "../client";
import { markJobRunning, markJobCompleted, markJobFailed, updateJobProgress } from "../job-helper";

export const discoverAffairs = inngest.createFunction(
  {
    id: "discover-affairs",
    retries: 2,
    concurrency: { limit: 1, key: '"discover-affairs"' },
  },
  { event: "sync/discover-affairs" },
  async ({ event, step }) => {
    const jobId = event.data.jobId as string | undefined;
    if (jobId) await markJobRunning(jobId);

    try {
      await step.run("discover", async () => {
        execSync("npx tsx scripts/discover-affairs.ts", {
          stdio: "inherit",
          env: { ...process.env },
          timeout: 10 * 60 * 1000,
        });
        if (jobId) await updateJobProgress(jobId, 50);
      });

      await step.run("reconcile", async () => {
        execSync("npx tsx scripts/reconcile-affairs.ts --auto-merge", {
          stdio: "inherit",
          env: { ...process.env },
          timeout: 5 * 60 * 1000,
        });
      });

      if (jobId)
        await markJobCompleted(jobId, {
          steps: ["discover", "reconcile"],
        });
    } catch (err) {
      if (jobId) {
        await markJobFailed(jobId, err instanceof Error ? err.message : String(err));
      }
      throw err;
    }
  }
);
