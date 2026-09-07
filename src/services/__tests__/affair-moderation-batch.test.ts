import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/api/anthropic-batch", () => ({
  submitBatch: vi.fn(),
  getBatchStatus: vi.fn(),
  getBatchResults: vi.fn(),
}));

import { submitBatch, getBatchResults } from "@/lib/api/anthropic-batch";
import { getAnthropicUsage, resetAnthropicUsage } from "@/lib/api/anthropic";
import { submitModerationBatch, collectModerationBatch } from "@/services/affair-moderation-batch";
import type { ModerationInput } from "@/services/affair-moderation";

const input = (id: string, category = "CORRUPTION"): ModerationInput => ({
  affairId: id,
  title: `Affaire ${id}`,
  description: "Description factuelle.",
  status: "MISE_EN_EXAMEN",
  category,
  involvement: "DIRECT",
  politicianName: "Jean Dupont",
  politicianSlug: "jean-dupont",
  sources: [],
  factsDate: null,
  startDate: null,
  verdictDate: null,
  court: null,
  sentence: null,
  today: "2026-09-06",
});

const toolUse = (recommendation: string) => ({
  content: [
    {
      type: "tool_use",
      name: "moderate_affair",
      input: {
        recommendation,
        confidence: 90,
        reasoning: "ok",
        corrected_title: null,
        corrected_description: null,
        corrected_status: null,
        corrected_category: null,
        corrected_involvement: null,
        issues: [],
      },
    },
  ],
});

describe("submitModerationBatch", () => {
  beforeEach(() => vi.mocked(submitBatch).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("uses the affair id as custom_id, so results can be found again", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.mocked(submitBatch).mockResolvedValue({ id: "b1", processingStatus: "in_progress" });

    await submitModerationBatch([input("a1"), input("a2")]);

    const sent = vi.mocked(submitBatch).mock.calls[0]![0];
    expect(sent.map((r) => r.customId)).toEqual(["a1", "a2"]);
  });

  it("sends the cached prefix and disabled thinking, like the sync path", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.mocked(submitBatch).mockResolvedValue({ id: "b1", processingStatus: "in_progress" });

    await submitModerationBatch([input("a1")]);

    const params = vi.mocked(submitBatch).mock.calls[0]![0][0]!.params as Record<string, unknown>;
    expect(params.thinking).toEqual({ type: "disabled" });
    expect(params.system).toEqual([
      expect.objectContaining({ cache_control: { type: "ephemeral" } }),
    ]);
    expect(params.tool_choice).toEqual({ type: "tool", name: "moderate_affair" });
  });
});

describe("collectModerationBatch", () => {
  beforeEach(() => vi.mocked(getBatchResults).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("maps results by custom_id regardless of the order they arrive in", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.mocked(getBatchResults).mockResolvedValue([
      { customId: "a2", type: "succeeded", message: toolUse("REJECT") },
      { customId: "a1", type: "succeeded", message: toolUse("PUBLISH") },
    ]);

    const { results, failures } = await collectModerationBatch("b1", [input("a1"), input("a2")]);

    expect(results.get("a1")!.recommendation).toBe("PUBLISH");
    expect(results.get("a2")!.recommendation).toBe("REJECT");
    expect(failures.size).toBe(0);
  });

  it("still forces NEEDS_REVIEW on a sensitive category", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.mocked(getBatchResults).mockResolvedValue([
      { customId: "a1", type: "succeeded", message: toolUse("PUBLISH") },
    ]);

    const { results } = await collectModerationBatch("b1", [input("a1", "AGRESSION_SEXUELLE")]);

    expect(results.get("a1")!.recommendation).toBe("NEEDS_REVIEW");
    expect(results.get("a1")!.issues.some((i) => i.type === "SENSITIVE_CATEGORY")).toBe(true);
  });

  it("reports a submitted affair that never came back, instead of dropping it", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.mocked(getBatchResults).mockResolvedValue([
      { customId: "a1", type: "succeeded", message: toolUse("PUBLISH") },
    ]);

    const { results, failures } = await collectModerationBatch("b1", [input("a1"), input("a2")]);

    expect(results.has("a2")).toBe(false);
    expect(failures.get("a2")).toContain("absent");
  });

  it("records an errored entry as a failure rather than a result", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.mocked(getBatchResults).mockResolvedValue([
      { customId: "a1", type: "errored", error: '{"type":"overloaded_error"}' },
    ]);

    const { results, failures } = await collectModerationBatch("b1", [input("a1")]);

    expect(results.size).toBe(0);
    expect(failures.get("a1")).toContain("errored");
  });

  it("ignores a result for something that was never submitted", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.mocked(getBatchResults).mockResolvedValue([
      { customId: "inconnu", type: "succeeded", message: toolUse("PUBLISH") },
      { customId: "a1", type: "succeeded", message: toolUse("PUBLISH") },
    ]);

    const { results } = await collectModerationBatch("b1", [input("a1")]);

    expect([...results.keys()]).toEqual(["a1"]);
  });
});

describe("comptabilisation de l'usage sur le chemin batch", () => {
  beforeEach(() => {
    vi.mocked(getBatchResults).mockReset();
    resetAnthropicUsage();
  });
  afterEach(() => vi.restoreAllMocks());

  const withUsage = (recommendation: string, usage: Record<string, number>) => ({
    ...toolUse(recommendation),
    usage,
  });

  it("alimente le compteur avec un libellé distinct du chemin synchrone", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.mocked(getBatchResults).mockResolvedValue([
      {
        customId: "a1",
        type: "succeeded",
        message: withUsage("PUBLISH", {
          input_tokens: 500,
          output_tokens: 200,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 3270,
        }),
      },
    ]);

    await collectModerationBatch("b1", [input("a1")]);

    const keys = Object.keys(getAnthropicUsage());
    expect(keys).toHaveLength(1);
    expect(keys[0]).toContain("affair-moderation-batch@");
    const totals = getAnthropicUsage()[keys[0]!]!;
    expect(totals.cacheReadTokens).toBe(3270);
    expect(totals.outputTokens).toBe(200);
  });

  it("ne compte rien quand le résultat ne porte pas de bloc usage", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.mocked(getBatchResults).mockResolvedValue([
      { customId: "a1", type: "succeeded", message: toolUse("PUBLISH") },
    ]);

    await collectModerationBatch("b1", [input("a1")]);

    expect(getAnthropicUsage()).toEqual({});
  });
});

describe("moderationInputFingerprint", () => {
  it("change dès qu'un champ du prompt change", async () => {
    const { moderationInputFingerprint } = await import("@/services/affair-moderation");
    const base = input("a1");
    expect(moderationInputFingerprint(base)).toBe(moderationInputFingerprint(input("a1")));
    expect(moderationInputFingerprint({ ...base, title: "Autre titre" })).not.toBe(
      moderationInputFingerprint(base)
    );
    expect(moderationInputFingerprint({ ...base, category: "VIOLENCE" })).not.toBe(
      moderationInputFingerprint(base)
    );
  });

  it("est stable quel que soit l'ordre de déclaration des clés", async () => {
    const { moderationInputFingerprint } = await import("@/services/affair-moderation");

    // Mêmes valeurs, clés déclarées dans l'ordre inverse : canonicalJson trie à
    // toute profondeur, donc l'empreinte ne doit pas bouger.
    const a: ModerationInput = {
      affairId: "a1",
      title: "Affaire a1",
      description: "Description factuelle.",
      status: "MISE_EN_EXAMEN",
      category: "CORRUPTION",
      involvement: "DIRECT",
      politicianName: "Jean Dupont",
      politicianSlug: "jean-dupont",
      sources: [],
      factsDate: null,
      startDate: null,
      verdictDate: null,
      court: null,
      sentence: null,
      today: "2026-09-06",
    };
    const b: ModerationInput = {
      today: "2026-09-06",
      sentence: null,
      court: null,
      verdictDate: null,
      startDate: null,
      factsDate: null,
      sources: [],
      politicianSlug: "jean-dupont",
      politicianName: "Jean Dupont",
      involvement: "DIRECT",
      category: "CORRUPTION",
      status: "MISE_EN_EXAMEN",
      description: "Description factuelle.",
      title: "Affaire a1",
      affairId: "a1",
    };

    expect(moderationInputFingerprint(b)).toBe(moderationInputFingerprint(a));
  });
});
