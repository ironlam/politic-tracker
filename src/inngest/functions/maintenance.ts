import { execSync } from "child_process";
import { inngest } from "../client";
import { markJobRunning, markJobCompleted, markJobFailed, updateJobProgress } from "../job-helper";

export const maintenance = inngest.createFunction(
  {
    id: "maintenance",
    retries: 2,
    concurrency: { limit: 1, key: '"maintenance"' },
  },
  { event: "sync/maintenance" },
  async ({ event, step }) => {
    const jobId = event.data.jobId as string | undefined;
    if (jobId) await markJobRunning(jobId);

    try {
      await step.run("prominence", async () => {
        execSync("npx tsx scripts/recalculate-prominence.ts", {
          stdio: "inherit",
          env: { ...process.env },
          timeout: 5 * 60 * 1000,
        });
        if (jobId) await updateJobProgress(jobId, 50);
      });

      await step.run("publication-status", async () => {
        execSync("npx tsx scripts/assign-publication-status.ts", {
          stdio: "inherit",
          env: { ...process.env },
          timeout: 5 * 60 * 1000,
        });
      });

      if (jobId)
        await markJobCompleted(jobId, {
          steps: ["prominence", "publication-status"],
        });
    } catch (err) {
      if (jobId) {
        await markJobFailed(jobId, err instanceof Error ? err.message : String(err));
      }
      throw err;
    }
  }
);
