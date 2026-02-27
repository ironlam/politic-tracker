import { inngest } from "../client";

interface DailyStep {
  name: string;
  run: () => Promise<unknown>;
}

const DAILY_STEPS: DailyStep[] = [
  {
    name: "votes-an",
    run: async () => {
      const { syncVotesAN } = await import("@/services/sync/votes-an");
      return syncVotesAN(undefined, false, true);
    },
  },
  {
    name: "votes-senat",
    run: async () => {
      const { syncVotesSenat } = await import("@/services/sync/votes-senat");
      return syncVotesSenat(null, false, true);
    },
  },
  {
    name: "legislation",
    run: async () => {
      const { syncLegislation } = await import("@/services/sync/legislation");
      return syncLegislation({ activeOnly: true });
    },
  },
  {
    name: "legislation-content",
    run: async () => {
      const { syncLegislationContent } = await import("@/services/sync/legislation-content");
      return syncLegislationContent({ limit: 20 });
    },
  },
  {
    name: "summaries-dossiers",
    run: async () => {
      const { generateSummaries } = await import("@/services/sync/generate-summaries");
      return generateSummaries({ limit: 10 });
    },
  },
  {
    name: "summaries-scrutins",
    run: async () => {
      const { generateScrutinSummaries } =
        await import("@/services/sync/generate-scrutin-summaries");
      return generateScrutinSummaries({ limit: 20 });
    },
  },
  {
    name: "press-rss",
    run: async () => {
      const { syncPress } = await import("@/services/sync/press");
      return syncPress();
    },
  },
  {
    name: "press-analysis",
    run: async () => {
      const { syncPressAnalysis } = await import("@/services/sync/press-analysis");
      return syncPressAnalysis({ limit: 100 });
    },
  },
  {
    name: "judilibre",
    run: async () => {
      const { syncJudilibre } = await import("@/services/sync/judilibre");
      return syncJudilibre({ limit: 20 });
    },
  },
  {
    name: "reconcile-affairs",
    run: async () => {
      const { reconcileAffairs } = await import("@/services/sync/reconcile-affairs");
      return reconcileAffairs({ autoMerge: true });
    },
  },
  {
    name: "factchecks",
    run: async () => {
      const { syncFactchecks } = await import("@/services/sync/factchecks");
      return syncFactchecks({ limit: 50 });
    },
  },
  {
    name: "classify-themes",
    run: async () => {
      const { classifyThemes } = await import("@/services/sync/classify-themes");
      return classifyThemes({ limit: 30 });
    },
  },
  {
    name: "embeddings-factchecks",
    run: async () => {
      const { indexAllOfType } = await import("@/services/embeddings");
      return indexAllOfType("FACTCHECK", { deltaOnly: true });
    },
  },
  {
    name: "embeddings-press",
    run: async () => {
      const { indexAllOfType } = await import("@/services/embeddings");
      return indexAllOfType("PRESS_ARTICLE", { deltaOnly: true });
    },
  },
  {
    name: "prominence",
    run: async () => {
      const { recalculateProminence } = await import("@/services/sync/prominence");
      return recalculateProminence();
    },
  },
  {
    name: "publication-status",
    run: async () => {
      const { assignPublicationStatus } = await import("@/services/sync/publication-status");
      return assignPublicationStatus();
    },
  },
  {
    name: "compute-stats",
    run: async () => {
      const { computeStats } = await import("@/services/sync/compute-stats");
      return computeStats();
    },
  },
];

export const syncDaily = inngest.createFunction(
  {
    id: "sync-daily",
    retries: 0,
    concurrency: { limit: 1 },
  },
  [{ cron: "0 5,11,19 * * *" }, { event: "sync/daily" }],
  async ({ step }) => {
    const results: Array<{
      name: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const s of DAILY_STEPS) {
      const result = await step.run(s.name, async () => {
        try {
          await s.run();
          return { success: true as const };
        } catch (err) {
          // Don't throw — continue to next step
          return {
            success: false as const,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      });

      results.push({ name: s.name, ...result });
    }

    const failed = results.filter((r) => !r.success);
    return {
      total: results.length,
      succeeded: results.length - failed.length,
      failed: failed.length,
      failures: failed.map((f) => f.name),
    };
  }
);
