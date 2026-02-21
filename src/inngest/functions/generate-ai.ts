import { execSync } from "child_process";
import { inngest } from "../client";
import { markJobRunning, markJobCompleted, markJobFailed, updateJobProgress } from "../job-helper";

export const generateAi = inngest.createFunction(
  {
    id: "generate-ai",
    retries: 2,
    concurrency: { limit: 1, key: '"generate-ai"' },
  },
  { event: "sync/generate-ai" },
  async ({ event, step }) => {
    const jobId = event.data.jobId as string | undefined;
    if (jobId) await markJobRunning(jobId);

    try {
      await step.run("biographies", async () => {
        execSync("npx tsx scripts/generate-biographies.ts", {
          stdio: "inherit",
          env: { ...process.env },
          timeout: 10 * 60 * 1000,
        });
        if (jobId) await updateJobProgress(jobId, 25);
      });

      await step.run("summaries", async () => {
        execSync("npx tsx scripts/generate-summaries.ts", {
          stdio: "inherit",
          env: { ...process.env },
          timeout: 10 * 60 * 1000,
        });
        if (jobId) await updateJobProgress(jobId, 50);
      });

      await step.run("scrutin-summaries", async () => {
        execSync("npx tsx scripts/generate-scrutin-summaries.ts", {
          stdio: "inherit",
          env: { ...process.env },
          timeout: 10 * 60 * 1000,
        });
        if (jobId) await updateJobProgress(jobId, 75);
      });

      await step.run("classify-themes", async () => {
        execSync("npx tsx scripts/classify-themes.ts", {
          stdio: "inherit",
          env: { ...process.env },
          timeout: 10 * 60 * 1000,
        });
      });

      if (jobId)
        await markJobCompleted(jobId, {
          steps: ["biographies", "summaries", "scrutin-summaries", "classify-themes"],
        });
    } catch (err) {
      if (jobId) {
        await markJobFailed(jobId, err instanceof Error ? err.message : String(err));
      }
      throw err;
    }
  }
);
