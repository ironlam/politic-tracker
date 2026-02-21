import { execSync } from "child_process";
import { inngest } from "../client";
import { markJobRunning, markJobCompleted, markJobFailed } from "../job-helper";

/**
 * Factory to create an Inngest function wrapping a single sync script.
 * Used for every script in the admin SCRIPT_CATALOG.
 */
export function createSyncFunction(scriptId: string, timeoutMinutes = 10) {
  return inngest.createFunction(
    {
      id: scriptId,
      retries: 2,
      concurrency: { limit: 1, key: `"${scriptId}"` },
    },
    { event: `sync/${scriptId}` },
    async ({ event, step }) => {
      const jobId = event.data.jobId as string | undefined;
      if (jobId) await markJobRunning(jobId);

      try {
        await step.run(scriptId, async () => {
          const flags = (event.data.flags as string) || "";
          execSync(`npx tsx scripts/${scriptId}.ts ${flags}`.trim(), {
            stdio: "inherit",
            env: { ...process.env },
            timeout: timeoutMinutes * 60 * 1000,
          });
        });

        if (jobId) await markJobCompleted(jobId);
      } catch (err) {
        if (jobId) {
          await markJobFailed(jobId, err instanceof Error ? err.message : String(err));
        }
        throw err;
      }
    }
  );
}
