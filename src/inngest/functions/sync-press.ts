import { inngest } from "../client";
import { markJobRunning, markJobCompleted, markJobFailed, updateJobProgress } from "../job-helper";
import { syncPress as syncPressService } from "@/services/sync/press";
import { syncPressAnalysis } from "@/services/sync/press-analysis";

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
        const stats = await syncPressService();
        if (jobId) await updateJobProgress(jobId, 50);
        return stats;
      });

      // Step 2: AI analysis
      const analysisStats = await step.run("ai-analysis", async () => {
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
