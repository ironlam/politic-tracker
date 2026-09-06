import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  callAnthropic,
  AnthropicApiError,
  isInsufficientCreditError,
  __resetCreditAlertForTests,
} from "../anthropic";

const CREDIT_BODY = JSON.stringify({
  type: "error",
  error: {
    type: "invalid_request_error",
    message: "Your credit balance is too low to access the Anthropic API.",
  },
});

function mockResponse(status: number, body: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body),
    json: () => Promise.resolve(JSON.parse(body)),
  };
}

describe("callAnthropic error classification", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    __resetCreditAlertForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("throws when ANTHROPIC_API_KEY is missing", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    await expect(callAnthropic([{ role: "user", content: "x" }])).rejects.toThrow(
      "ANTHROPIC_API_KEY"
    );
  });

  it("keeps the historical message format so existing log greps still match", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(500, "boom")));
    await expect(callAnthropic([{ role: "user", content: "x" }])).rejects.toThrow(
      "Anthropic API error 500: boom"
    );
  });

  it("exposes status and error.type on the thrown error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(400, CREDIT_BODY)));
    const err = await callAnthropic([{ role: "user", content: "x" }]).catch((e) => e);
    expect(err).toBeInstanceOf(AnthropicApiError);
    expect((err as AnthropicApiError).status).toBe(400);
    expect((err as AnthropicApiError).errorType).toBe("invalid_request_error");
  });

  it("flags the credit-balance case", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(400, CREDIT_BODY)));
    const err = await callAnthropic([{ role: "user", content: "x" }]).catch((e) => e);
    expect(isInsufficientCreditError(err)).toBe(true);
  });

  it("does NOT flag a rate limit, a server error or another 400", async () => {
    const cases: [number, string][] = [
      [429, JSON.stringify({ error: { type: "rate_limit_error", message: "slow down" } })],
      [500, JSON.stringify({ error: { type: "api_error", message: "oops" } })],
      [
        400,
        JSON.stringify({
          error: { type: "invalid_request_error", message: "max_tokens: must be >= 1" },
        }),
      ],
    ];
    for (const [status, body] of cases) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(status, body)));
      const err = await callAnthropic([{ role: "user", content: "x" }]).catch((e) => e);
      expect(isInsufficientCreditError(err), `status ${status}`).toBe(false);
    }
  });

  it("is false for a non-Anthropic error", () => {
    expect(isInsufficientCreditError(new Error("credit balance too low"))).toBe(false);
    expect(isInsufficientCreditError(null)).toBe(false);
  });

  it("logs one distinct ALERT line per process, not one per call", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(400, CREDIT_BODY)));

    for (let i = 0; i < 3; i++) {
      await callAnthropic([{ role: "user", content: "x" }]).catch(() => {});
    }

    const alerts = spy.mock.calls.filter((c) => String(c[0]).includes("ANTHROPIC_CREDIT_EXHAUSTED"));
    expect(alerts).toHaveLength(1);
  });

  it("does not emit the ALERT line for unrelated failures", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(429, "slow down")));
    await callAnthropic([{ role: "user", content: "x" }]).catch(() => {});
    expect(
      spy.mock.calls.filter((c) => String(c[0]).includes("ANTHROPIC_CREDIT_EXHAUSTED"))
    ).toHaveLength(0);
  });
});
