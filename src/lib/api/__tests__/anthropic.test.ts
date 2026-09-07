import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  callAnthropic,
  AnthropicApiError,
  isInsufficientCreditError,
  __resetCreditAlertForTests,
  getAnthropicUsage,
  resetAnthropicUsage,
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

    const alerts = spy.mock.calls.filter((c) =>
      String(c[0]).includes("ANTHROPIC_CREDIT_EXHAUSTED")
    );
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

describe("usage accounting", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    resetAnthropicUsage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function okResponse(usage: Record<string, number> | undefined) {
    return {
      ok: true,
      status: 200,
      text: () => Promise.resolve(""),
      json: () => Promise.resolve({ content: [], ...(usage ? { usage } : {}) }),
    };
  }

  it("accumulates the four priced quantities per site and model", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        okResponse({
          input_tokens: 500,
          output_tokens: 200,
          cache_creation_input_tokens: 3270,
          cache_read_input_tokens: 0,
        })
      )
    );

    await callAnthropic([{ role: "user", content: "x" }], {
      label: "affair-moderation",
      model: "claude-sonnet-5",
    });
    await callAnthropic([{ role: "user", content: "x" }], {
      label: "affair-moderation",
      model: "claude-sonnet-5",
    });

    const totals = getAnthropicUsage()["affair-moderation@claude-sonnet-5"];
    expect(totals).toEqual({
      calls: 2,
      inputTokens: 1000,
      outputTokens: 400,
      cacheCreationTokens: 6540,
      cacheReadTokens: 0,
    });
  });

  it("keeps sites and models in separate buckets", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(okResponse({ input_tokens: 10, output_tokens: 5 }))
    );

    await callAnthropic([{ role: "user", content: "x" }], { label: "a", model: "claude-sonnet-5" });
    await callAnthropic([{ role: "user", content: "x" }], { label: "b", model: "claude-sonnet-5" });
    await callAnthropic([{ role: "user", content: "x" }], {
      label: "a",
      model: "claude-haiku-4-5",
    });

    expect(Object.keys(getAnthropicUsage()).sort()).toEqual([
      "a@claude-haiku-4-5",
      "a@claude-sonnet-5",
      "b@claude-sonnet-5",
    ]);
  });

  it("logs a greppable line carrying the cache meters", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        okResponse({
          input_tokens: 500,
          output_tokens: 200,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 3270,
        })
      )
    );

    await callAnthropic([{ role: "user", content: "x" }], {
      label: "affair-moderation",
      model: "claude-sonnet-5",
    });

    const line = spy.mock.calls
      .map((c) => String(c[0]))
      .find((l) => l.includes("[anthropic] usage"));
    expect(line).toContain("site=affair-moderation");
    expect(line).toContain("cache_read=3270");
    expect(line).toContain("cache_write=0");
  });

  it("does not throw when the response carries no usage block", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse(undefined)));
    await expect(
      callAnthropic([{ role: "user", content: "x" }], { label: "a" })
    ).resolves.toBeDefined();
    expect(getAnthropicUsage()).toEqual({});
  });
});

describe("prompt caching", () => {
  beforeEach(() => vi.stubEnv("ANTHROPIC_API_KEY", "test-key"));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function capture() {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(""),
      json: () => Promise.resolve({ content: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  const bodyOf = (m: ReturnType<typeof vi.fn>) =>
    JSON.parse((m.mock.calls[0]![1] as { body: string }).body);

  it("puts the breakpoint on the system block when cachePrefix is set", async () => {
    const m = capture();
    await callAnthropic([{ role: "user", content: "x" }], {
      system: "SYS",
      tools: [{ name: "t" }],
      cachePrefix: true,
    });
    expect(bodyOf(m).system).toEqual([
      { type: "text", text: "SYS", cache_control: { type: "ephemeral" } },
    ]);
  });

  it("leaves the system prompt a plain string by default", async () => {
    const m = capture();
    await callAnthropic([{ role: "user", content: "x" }], { system: "SYS" });
    expect(bodyOf(m).system).toBe("SYS");
  });

  it("still sends tools alongside the cached system block", async () => {
    const m = capture();
    await callAnthropic([{ role: "user", content: "x" }], {
      system: "SYS",
      tools: [{ name: "moderate_affair" }],
      cachePrefix: true,
    });
    expect(bodyOf(m).tools).toEqual([{ name: "moderate_affair" }]);
  });

  it("sends no system field at all when there is no system prompt", async () => {
    const m = capture();
    await callAnthropic([{ role: "user", content: "x" }], { cachePrefix: true });
    expect(bodyOf(m).system).toBeUndefined();
  });
});
