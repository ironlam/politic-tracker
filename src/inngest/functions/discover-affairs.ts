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
      const discoverStats = await step.run("discover", async () => {
        const { discoverAffairs: discoverAffairsService } =
          await import("@/services/sync/discover-affairs");
        const result = await discoverAffairsService();
        if (jobId) await updateJobProgress(jobId, 50);
        return result;
      });

      const reconcileStats = await step.run("reconcile", async () => {
        const { reconcileAffairs } = await import("@/services/sync/reconcile-affairs");
        return reconcileAffairs({ autoMerge: true });
      });

      if (jobId)
        await markJobCompleted(jobId, {
          steps: ["discover", "reconcile"],
          discoverStats,
          reconcileStats,
        });
    } catch (err) {
      if (jobId) {
        await markJobFailed(jobId, err instanceof Error ? err.message : String(err));
      }
      throw err;
    }
  }
);
