import { safeJsonParse } from "@/lib/api/safe-json";
import { AnthropicApiError, isInsufficientCreditError } from "@/lib/api/anthropic";

const BATCH_API_URL = "https://api.anthropic.com/v1/messages/batches";

function getApiKey(): string {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  return apiKey;
}

/** One request in a batch. `customId` is how the result is found again. */
export interface BatchRequest {
  customId: string;
  params: Record<string, unknown>;
}

export interface BatchHandle {
  id: string;
  processingStatus: "in_progress" | "canceling" | "ended";
}

export type BatchResult =
  | { customId: string; type: "succeeded"; message: unknown }
  | { customId: string; type: "errored" | "canceled" | "expired"; error: string };

async function request(path: string, init: RequestInit): Promise<Response> {
  const response = await fetch(`${BATCH_API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": getApiKey(),
      "anthropic-version": "2023-06-01",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "Unknown error");
    const parsed = safeJsonParse<{ error?: { type?: unknown } }>(body);
    const errorType =
      parsed.success && typeof parsed.data?.error?.type === "string"
        ? parsed.data.error.type
        : null;
    const error = new AnthropicApiError(response.status, body, errorType);
    if (isInsufficientCreditError(error)) {
      console.error(
        "[anthropic] ALERT ANTHROPIC_CREDIT_EXHAUSTED — crédit API épuisé (batch). " +
          `status=${response.status}`
      );
    }
    throw error;
  }

  return response;
}

/** Submit a batch. Every token in it bills at half the standard rate. */
export async function submitBatch(requests: BatchRequest[]): Promise<BatchHandle> {
  if (requests.length === 0) throw new Error("submitBatch called with no requests");

  const ids = new Set(requests.map((r) => r.customId));
  if (ids.size !== requests.length) {
    // Results are keyed by custom_id, so a duplicate silently loses a result.
    throw new Error("submitBatch requires unique customId values");
  }

  const response = await request("", {
    method: "POST",
    body: JSON.stringify({
      requests: requests.map((r) => ({ custom_id: r.customId, params: r.params })),
    }),
  });

  const json = (await response.json()) as { id: string; processing_status: string };
  return {
    id: json.id,
    processingStatus: json.processing_status as BatchHandle["processingStatus"],
  };
}

export async function getBatchStatus(batchId: string): Promise<BatchHandle> {
  const response = await request(`/${encodeURIComponent(batchId)}`, { method: "GET" });
  const json = (await response.json()) as { id: string; processing_status: string };
  return {
    id: json.id,
    processingStatus: json.processing_status as BatchHandle["processingStatus"],
  };
}

/**
 * Fetch results. The response is JSONL and arrives in ANY order, so callers
 * must key by customId rather than by position.
 */
export async function getBatchResults(batchId: string): Promise<BatchResult[]> {
  const response = await request(`/${encodeURIComponent(batchId)}/results`, { method: "GET" });
  const text = await response.text();

  const out: BatchResult[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parsed = safeJsonParse<{
      custom_id?: string;
      result?: { type?: string; message?: unknown; error?: unknown };
    }>(trimmed);
    if (!parsed.success || !parsed.data.custom_id) continue;

    const customId = parsed.data.custom_id;
    const type = parsed.data.result?.type;
    if (type === "succeeded") {
      out.push({ customId, type: "succeeded", message: parsed.data.result?.message });
    } else {
      out.push({
        customId,
        type: (type as "errored" | "canceled" | "expired") ?? "errored",
        error: JSON.stringify(parsed.data.result?.error ?? { type }),
      });
    }
  }
  return out;
}
