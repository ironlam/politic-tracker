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
      const anStats = await step.run("votes-an", async () => {
        const { syncVotesAN } = await import("@/services/sync/votes-an");
        const stats = await syncVotesAN(undefined, false, true);
        if (jobId) await updateJobProgress(jobId, 50);
        return stats;
      });

      const senatStats = await step.run("votes-senat", async () => {
        const { syncVotesSenat } = await import("@/services/sync/votes-senat");
        return syncVotesSenat(null, false, true);
      });

      if (jobId)
        await markJobCompleted(jobId, {
          steps: ["votes-an", "votes-senat"],
          anStats,
          senatStats,
        });
    } catch (err) {
      if (jobId) {
        await markJobFailed(jobId, err instanceof Error ? err.message : String(err));
      }
      throw err;
    }
  }
);
