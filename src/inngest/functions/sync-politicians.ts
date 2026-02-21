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
      const anStats = await step.run("assemblee", async () => {
        const { syncDeputies } = await import("@/services/sync/deputies");
        const result = await syncDeputies();
        if (jobId) await updateJobProgress(jobId, 20);
        return result;
      });

      const senatStats = await step.run("senat", async () => {
        const { syncSenators } = await import("@/services/sync/senators");
        const result = await syncSenators();
        if (jobId) await updateJobProgress(jobId, 40);
        return result;
      });

      const gouvStats = await step.run("gouvernement", async () => {
        const { syncGovernment } = await import("@/services/sync/government");
        const result = await syncGovernment();
        if (jobId) await updateJobProgress(jobId, 60);
        return result;
      });

      const euStats = await step.run("europarl", async () => {
        const { syncEuroparl } = await import("@/services/sync/europarl");
        const result = await syncEuroparl();
        if (jobId) await updateJobProgress(jobId, 80);
        return result;
      });

      const photoStats = await step.run("photos", async () => {
        const { syncPhotos } = await import("@/services/sync/photos");
        return syncPhotos();
      });

      if (jobId)
        await markJobCompleted(jobId, {
          steps: ["assemblee", "senat", "gouvernement", "europarl", "photos"],
          anStats,
          senatStats,
          gouvStats,
          euStats,
          photoStats,
        });
    } catch (err) {
      if (jobId) {
        await markJobFailed(jobId, err instanceof Error ? err.message : String(err));
      }
      throw err;
    }
  }
);
