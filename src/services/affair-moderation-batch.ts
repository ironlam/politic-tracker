/**
 * Batch path for affair moderation.
 *
 * Same prompt, same tool schema, same validation as `moderateAffair` — only the
 * transport differs. Every token bills at half the standard rate, and the
 * discount stacks with the cached prefix.
 *
 * Deliberately does NOT apply a fallback for missing or failed results: the
 * caller owns that decision, and its safe default (NEEDS_REVIEW) must stay
 * exactly where it was.
 */
import {
  submitBatch,
  getBatchStatus,
  getBatchResults,
  type BatchRequest,
} from "@/lib/api/anthropic-batch";
import { extractToolUse, type AnthropicResponse } from "@/lib/api/anthropic";
import {
  buildModerationParams,
  parseModerationResult,
  type ModerationInput,
  type ModerationResult,
} from "@/services/affair-moderation";

export interface BatchModerationOutcome {
  /** Successfully parsed results, keyed by affairId. */
  results: Map<string, ModerationResult>;
  /** affairId -> reason, for everything the caller must fall back on. */
  failures: Map<string, string>;
}

/** Submit one moderation request per input. Returns the batch id. */
export async function submitModerationBatch(inputs: ModerationInput[]): Promise<string> {
  const requests: BatchRequest[] = inputs.map((input) => ({
    customId: input.affairId,
    params: buildModerationParams(input),
  }));
  const handle = await submitBatch(requests);
  console.log(`[moderation-batch] soumis batch=${handle.id} requests=${requests.length}`);
  return handle.id;
}

export async function isBatchReady(batchId: string): Promise<boolean> {
  const handle = await getBatchStatus(batchId);
  return handle.processingStatus === "ended";
}

/**
 * Read a finished batch back into ModerationResults.
 *
 * `inputs` must be the same list that was submitted: the affair data is needed
 * again to validate the payload (the sensitive-category guard reads the
 * affair's category, not the model's answer).
 */
export async function collectModerationBatch(
  batchId: string,
  inputs: ModerationInput[]
): Promise<BatchModerationOutcome> {
  const byId = new Map(inputs.map((i) => [i.affairId, i]));
  const results = new Map<string, ModerationResult>();
  const failures = new Map<string, string>();

  const raw = await getBatchResults(batchId);

  for (const entry of raw) {
    const input = byId.get(entry.customId);
    if (!input) {
      // A result for something we did not submit: ignore rather than guess.
      continue;
    }

    if (entry.type !== "succeeded") {
      failures.set(entry.customId, `batch result ${entry.type}: ${entry.error}`);
      continue;
    }

    const toolUse = extractToolUse(entry.message as AnthropicResponse) as Record<
      string,
      unknown
    > | null;
    if (!toolUse) {
      failures.set(entry.customId, "no tool_use content in batch result");
      continue;
    }

    try {
      results.set(entry.customId, parseModerationResult(toolUse, input));
    } catch (err) {
      failures.set(entry.customId, err instanceof Error ? err.message : String(err));
    }
  }

  // Anything submitted but absent from the results is a failure too, otherwise
  // a silently dropped affair would look like it was never queued.
  for (const input of inputs) {
    if (!results.has(input.affairId) && !failures.has(input.affairId)) {
      failures.set(input.affairId, "absent des résultats du batch");
    }
  }

  console.log(
    `[moderation-batch] relevé batch=${batchId} ok=${results.size} échecs=${failures.size}`
  );
  return { results, failures };
}
