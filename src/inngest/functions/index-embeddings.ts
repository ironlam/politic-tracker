import { execSync } from "child_process";
import { inngest } from "../client";
import { markJobRunning, markJobCompleted, markJobFailed } from "../job-helper";

export const indexEmbeddings = inngest.createFunction(
  {
    id: "index-embeddings",
    retries: 2,
    concurrency: { limit: 1, key: '"index-embeddings"' },
  },
  { event: "sync/index-embeddings" },
  async ({ event, step }) => {
    const jobId = event.data.jobId as string | undefined;
    if (jobId) await markJobRunning(jobId);

    try {
      await step.run("embeddings", async () => {
        execSync("npx tsx scripts/index-embeddings.ts", {
          stdio: "inherit",
          env: { ...process.env },
          timeout: 10 * 60 * 1000,
        });
      });

      if (jobId)
        await markJobCompleted(jobId, {
          steps: ["embeddings"],
        });
    } catch (err) {
      if (jobId) {
        await markJobFailed(jobId, err instanceof Error ? err.message : String(err));
      }
      throw err;
    }
  }
);
