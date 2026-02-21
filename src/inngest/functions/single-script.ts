import { inngest } from "../client";
import { markJobRunning, markJobCompleted, markJobFailed } from "../job-helper";

/**
 * Factory to create an Inngest function wrapping a sync service.
 * The handler receives event.data and returns any result.
 */
export function createSyncFunction(
  scriptId: string,
  handler: (data: Record<string, unknown>) => Promise<unknown>
) {
  return inngest.createFunction(
    {
      id: `script/${scriptId}`,
      retries: 2,
      concurrency: { limit: 1, key: `"${scriptId}"` },
    },
    { event: `sync/${scriptId}` },
    async ({ event, step }) => {
      const jobId = event.data.jobId as string | undefined;
      if (jobId) await markJobRunning(jobId);

      try {
        const result = await step.run(scriptId, () => handler(event.data));
        if (jobId) await markJobCompleted(jobId);
        return result;
      } catch (err) {
        if (jobId) {
          await markJobFailed(jobId, err instanceof Error ? err.message : String(err));
        }
        throw err;
      }
    }
  );
}

/**
 * Factory for scripts not yet migrated to direct imports.
 * Immediately marks the job as FAILED with a helpful message.
 */
export function createStubFunction(scriptId: string) {
  return inngest.createFunction(
    {
      id: `script/${scriptId}`,
      retries: 0,
    },
    { event: `sync/${scriptId}` },
    async ({ event }) => {
      const jobId = event.data.jobId as string | undefined;
      if (jobId) {
        await markJobFailed(
          jobId,
          `"${scriptId}" pas encore disponible via Inngest. Utiliser la CLI locale.`
        );
      }
    }
  );
}
