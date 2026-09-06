import { safeJsonParse, safeJsonParseOrThrow } from "@/lib/api/safe-json";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

function getApiKey(): string {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  return apiKey;
}

/**
 * A non-2xx response from the Messages API, with the pieces needed to tell a
 * billing outage apart from a transient failure or a malformed request. The
 * message keeps the historical `Anthropic API error <status>: <body>` shape so
 * existing logs and greps still match.
 */
export class AnthropicApiError extends Error {
  readonly status: number;
  /** `error.type` from the response body ("invalid_request_error", "rate_limit_error", ...). */
  readonly errorType: string | null;
  readonly body: string;

  constructor(status: number, body: string, errorType: string | null) {
    super(`Anthropic API error ${status}: ${body}`);
    this.name = "AnthropicApiError";
    this.status = status;
    this.errorType = errorType;
    this.body = body;
  }
}

/**
 * True only for "your credit balance is too low", which is an OPS failure (the
 * account needs a top-up), not a code failure. Every caller that degrades to a
 * safe default should still degrade, but this lets it say WHY, so a billing
 * outage doesn't read like a transient API blip.
 *
 * Deliberately narrow: a 400 `invalid_request_error` also covers genuine bad
 * requests (bad max_tokens, malformed schema), which must NOT be reported as a
 * billing problem.
 */
export function isInsufficientCreditError(err: unknown): boolean {
  if (!(err instanceof AnthropicApiError)) return false;
  if (err.status !== 400) return false;
  if (err.errorType !== "invalid_request_error") return false;
  return /credit\s+balance/i.test(err.body);
}

// One ALERT line per process, not one per call: a preflight run over 30 drafts
// would otherwise bury the signal under 30 identical lines.
let creditAlertEmitted = false;

/** Test seam only. */
export function __resetCreditAlertForTests(): void {
  creditAlertEmitted = false;
}

function parseErrorType(body: string): string | null {
  const parsed = safeJsonParse<{ error?: { type?: unknown } }>(body);
  if (!parsed.success) return null;
  const type = parsed.data?.error?.type;
  return typeof type === "string" ? type : null;
}

export interface AnthropicOptions {
  model?: string;
  maxTokens?: number;
  system?: string;
  tools?: unknown[];
  toolChoice?: unknown;
}

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AnthropicResponse {
  content: Array<{ type: string; text?: string; input?: unknown; name?: string }>;
  usage?: { input_tokens: number; output_tokens: number };
  stop_reason?: string;
}

export async function callAnthropic(
  messages: AnthropicMessage[],
  options: AnthropicOptions = {}
): Promise<AnthropicResponse> {
  const {
    model = "claude-sonnet-4-5-20250929",
    maxTokens = 2000,
    system,
    tools,
    toolChoice,
  } = options;

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages,
  };
  if (system) body.system = system;
  if (tools) body.tools = tools;
  if (toolChoice) body.tool_choice = toolChoice;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": getApiKey(),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    const error = new AnthropicApiError(response.status, errorText, parseErrorType(errorText));

    if (isInsufficientCreditError(error) && !creditAlertEmitted) {
      creditAlertEmitted = true;
      // Distinct, greppable label: every AI feature backed by this wrapper is
      // down until the account is topped up, and callers that fall back to a
      // safe default would otherwise hide that completely.
      console.error(
        "[anthropic] ALERT ANTHROPIC_CREDIT_EXHAUSTED — crédit API épuisé, " +
          "toutes les fonctionnalités IA sont dégradées jusqu'au rechargement " +
          "(Anthropic Console > Plans & Billing). " +
          `model=${model} status=${response.status}`
      );
    }

    throw error;
  }

  return response.json();
}

export function extractToolUse(response: AnthropicResponse): unknown | null {
  const toolUse = response.content.find((c) => c.type === "tool_use");
  return toolUse?.input ?? null;
}

export function parseAnthropicJSON<T = unknown>(text: string): T {
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1]!.trim();
  return safeJsonParseOrThrow<T>(cleaned);
}
