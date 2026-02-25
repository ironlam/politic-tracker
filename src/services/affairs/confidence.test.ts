import { describe, it, expect } from "vitest";
import { clampConfidenceScore } from "./confidence";

describe("clampConfidenceScore", () => {
  it("returns the score unchanged when within 0-100", () => {
    expect(clampConfidenceScore(50)).toBe(50);
    expect(clampConfidenceScore(0)).toBe(0);
    expect(clampConfidenceScore(100)).toBe(100);
  });

  it("clamps values above 100 to 100", () => {
    expect(clampConfidenceScore(150)).toBe(100);
    expect(clampConfidenceScore(999)).toBe(100);
  });

  it("clamps values below 0 to 0", () => {
    expect(clampConfidenceScore(-10)).toBe(0);
    expect(clampConfidenceScore(-999)).toBe(0);
  });

  it("rounds non-integer values", () => {
    expect(clampConfidenceScore(75.7)).toBe(76);
    expect(clampConfidenceScore(49.2)).toBe(49);
  });

  it("handles NaN by returning 0", () => {
    expect(clampConfidenceScore(NaN)).toBe(0);
  });
});
