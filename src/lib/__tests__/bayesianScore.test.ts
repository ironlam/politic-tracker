import { describe, it, expect } from "vitest";
import { bayesianScore } from "../bayesianScore";

describe("bayesianScore", () => {
  it("returns global mean when sample size is 0", () => {
    expect(bayesianScore(0, 0, 0.45)).toBeCloseTo(0.45);
  });

  it("tends toward observed with large samples", () => {
    // 60/80 = 75% observed, global mean 45%
    const score = bayesianScore(0.75, 80, 0.45);
    // (10*0.45 + 80*0.75) / (10+80) = (4.5 + 60) / 90 = 0.7167
    expect(score).toBeCloseTo(0.7167, 3);
  });

  it("pulls small samples toward global mean", () => {
    // 3/4 = 75% observed, global mean 45%
    const score = bayesianScore(0.75, 4, 0.45);
    // (10*0.45 + 4*0.75) / (10+4) = (4.5 + 3) / 14 = 0.5357
    expect(score).toBeCloseTo(0.5357, 3);
  });

  it("ranks high-volume higher than low-volume at same proportion", () => {
    const lowVolume = bayesianScore(0.75, 4, 0.45);
    const highVolume = bayesianScore(0.75, 80, 0.45);
    expect(highVolume).toBeGreaterThan(lowVolume);
  });

  it("handles custom prior weight", () => {
    const score = bayesianScore(0.8, 20, 0.5, 5);
    // (5*0.5 + 20*0.8) / (5+20) = (2.5 + 16) / 25 = 0.74
    expect(score).toBeCloseTo(0.74);
  });

  it("returns 0 when both sample and prior are 0", () => {
    expect(bayesianScore(0.5, 0, 0.5, 0)).toBe(0);
  });
});
