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
      const result = await step.run("embeddings", async () => {
        const { indexAllOfType, indexGlobalStats } = await import("@/services/embeddings");
        const types = [
          "POLITICIAN",
          "PARTY",
          "AFFAIR",
          "DOSSIER",
          "SCRUTIN",
          "FACTCHECK",
          "PRESS_ARTICLE",
        ] as const;

        let totalIndexed = 0;
        let totalErrors = 0;

        for (const type of types) {
          const { indexed, errors } = await indexAllOfType(type, {
            deltaOnly: true,
          });
          totalIndexed += indexed;
          totalErrors += errors;
        }

        await indexGlobalStats();

        return { totalIndexed, totalErrors };
      });

      if (jobId)
        await markJobCompleted(jobId, {
          steps: ["embeddings"],
          ...result,
        });
    } catch (err) {
      if (jobId) {
        await markJobFailed(jobId, err instanceof Error ? err.message : String(err));
      }
      throw err;
    }
  }
);
