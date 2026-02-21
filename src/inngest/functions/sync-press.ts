import { inngest } from "../client";
import { markJobRunning, markJobCompleted, markJobFailed, updateJobProgress } from "../job-helper";

export const syncPress = inngest.createFunction(
  {
    id: "sync-press",
    retries: 2,
    concurrency: { limit: 1, key: '"sync-press"' },
  },
  { event: "sync/press" },
  async ({ event, step }) => {
    const jobId = event.data.jobId as string | undefined;
    if (jobId) await markJobRunning(jobId);

    try {
      // Step 1: Parse RSS feeds
      const rssStats = await step.run("parse-rss", async () => {
        const { syncPress: syncPressService } = await import("@/services/sync/press");
        const stats = await syncPressService();
        if (jobId) await updateJobProgress(jobId, 50);
        return stats;
      });

      // Step 2: AI analysis
      const analysisStats = await step.run("ai-analysis", async () => {
        const { syncPressAnalysis } = await import("@/services/sync/press-analysis");
        const limit = (event.data.limit as number) || 100;
        return syncPressAnalysis({ limit });
      });

      if (jobId)
        await markJobCompleted(jobId, {
          steps: ["parse-rss", "ai-analysis"],
          rssStats,
          analysisStats,
        });
    } catch (err) {
      if (jobId) {
        await markJobFailed(jobId, err instanceof Error ? err.message : String(err));
      }
      throw err;
    }
  }
);
