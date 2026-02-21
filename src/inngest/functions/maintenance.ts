import { inngest } from "../client";
import { markJobRunning, markJobCompleted, markJobFailed, updateJobProgress } from "../job-helper";
import { recalculateProminence } from "@/services/sync/prominence";
import { assignPublicationStatus } from "@/services/sync/publication-status";

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
      const promStats = await step.run("prominence", async () => {
        const stats = await recalculateProminence();
        if (jobId) await updateJobProgress(jobId, 50);
        return stats;
      });

      const pubStats = await step.run("publication-status", async () => {
        return assignPublicationStatus();
      });

      if (jobId)
        await markJobCompleted(jobId, {
          steps: ["prominence", "publication-status"],
          prominenceStats: promStats,
          publicationStatusStats: pubStats,
        });
    } catch (err) {
      if (jobId) {
        await markJobFailed(jobId, err instanceof Error ? err.message : String(err));
      }
      throw err;
    }
  }
);
