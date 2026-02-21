import { execSync } from "child_process";
import { inngest } from "../client";
import { markJobRunning, markJobCompleted, markJobFailed, updateJobProgress } from "../job-helper";

export const syncPoliticians = inngest.createFunction(
  {
    id: "sync-politicians",
    retries: 2,
    concurrency: { limit: 1, key: '"sync-politicians"' },
  },
  { event: "sync/politicians" },
  async ({ event, step }) => {
    const jobId = event.data.jobId as string | undefined;
    if (jobId) await markJobRunning(jobId);

    try {
      await step.run("assemblee", async () => {
        execSync("npx tsx scripts/sync-assemblee.ts", {
          stdio: "inherit",
          env: { ...process.env },
          timeout: 5 * 60 * 1000,
        });
        if (jobId) await updateJobProgress(jobId, 20);
      });

      await step.run("senat", async () => {
        execSync("npx tsx scripts/sync-senat.ts", {
          stdio: "inherit",
          env: { ...process.env },
          timeout: 5 * 60 * 1000,
        });
        if (jobId) await updateJobProgress(jobId, 40);
      });

      await step.run("gouvernement", async () => {
        execSync("npx tsx scripts/sync-gouvernement.ts", {
          stdio: "inherit",
          env: { ...process.env },
          timeout: 5 * 60 * 1000,
        });
        if (jobId) await updateJobProgress(jobId, 60);
      });

      await step.run("europarl", async () => {
        execSync("npx tsx scripts/sync-europarl.ts", {
          stdio: "inherit",
          env: { ...process.env },
          timeout: 5 * 60 * 1000,
        });
        if (jobId) await updateJobProgress(jobId, 80);
      });

      await step.run("photos", async () => {
        execSync("npx tsx scripts/sync-photos.ts", {
          stdio: "inherit",
          env: { ...process.env },
          timeout: 5 * 60 * 1000,
        });
      });

      if (jobId)
        await markJobCompleted(jobId, {
          steps: ["assemblee", "senat", "gouvernement", "europarl", "photos"],
        });
    } catch (err) {
      if (jobId) {
        await markJobFailed(jobId, err instanceof Error ? err.message : String(err));
      }
      throw err;
    }
  }
);
