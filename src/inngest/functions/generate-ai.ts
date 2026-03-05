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
      const bioStats = await step.run("biographies", async () => {
        const { generateBiographies } = await import("@/services/sync/generate-biographies");
        const result = await generateBiographies();
        if (jobId) await updateJobProgress(jobId, 20);
        return result;
      });

      const summaryStats = await step.run("summaries", async () => {
        const { generateSummaries } = await import("@/services/sync/generate-summaries");
        const result = await generateSummaries({ limit: 10 });
        if (jobId) await updateJobProgress(jobId, 40);
        return result;
      });

      const scrutinStats = await step.run("scrutin-summaries", async () => {
        const { generateScrutinSummaries } =
          await import("@/services/sync/generate-scrutin-summaries");
        const result = await generateScrutinSummaries({ limit: 20 });
        if (jobId) await updateJobProgress(jobId, 60);
        return result;
      });

      const citizenImpactStats = await step.run("citizen-impacts", async () => {
        const { generateScrutinCitizenImpacts } =
          await import("@/services/sync/generate-scrutin-citizen-impacts");
        const result = await generateScrutinCitizenImpacts({ limit: 20 });
        if (jobId) await updateJobProgress(jobId, 80);
        return result;
      });

      const themeStats = await step.run("classify-themes", async () => {
        const { classifyThemes } = await import("@/services/sync/classify-themes");
        return classifyThemes({ limit: 30 });
      });

      if (jobId)
        await markJobCompleted(jobId, {
          steps: [
            "biographies",
            "summaries",
            "scrutin-summaries",
            "citizen-impacts",
            "classify-themes",
          ],
          bioStats,
          summaryStats,
          scrutinStats,
          citizenImpactStats,
          themeStats,
        });
    } catch (err) {
      if (jobId) {
        await markJobFailed(jobId, err instanceof Error ? err.message : String(err));
      }
      throw err;
    }
  }
);
