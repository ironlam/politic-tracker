import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { scoreCandidate } from "@/lib/identity/resolver";
import { MatchMethod } from "@/generated/prisma";
import type { ScoringInput, CachedPolitician } from "@/lib/identity/types";
import { IDENTITY_THRESHOLDS } from "@/lib/identity/types";

function makePolitician(overrides: Partial<CachedPolitician> = {}): CachedPolitician {
  return {
    id: "pol-1",
    firstName: "Alma",
    lastName: "Dufour",
    birthDate: null,
    departments: ["76"],
    ...overrides,
  };
}

function makeInput(overrides: Partial<ScoringInput> = {}): ScoringInput {
  return {
    firstName: "Alma",
    lastName: "Dufour",
    department: "76",
    ...overrides,
  };
}

const noBlocked = new Set<string>();

describe("scoreCandidate", () => {
  describe("first name matching", () => {
    it("exact first name + department → high score (UNDECIDED zone)", () => {
      const result = scoreCandidate(
        makeInput({ firstName: "Alma" }),
        makePolitician({ firstName: "Alma" }),
        noBlocked
      );
      expect(result.score).toBeGreaterThanOrEqual(IDENTITY_THRESHOLDS.REVIEW);
      expect(result.score).toBeLessThan(IDENTITY_THRESHOLDS.AUTO_MATCH);
    });

    it("different first name + department → below REVIEW threshold", () => {
      const result = scoreCandidate(
        makeInput({ firstName: "Marie-Laure" }),
        makePolitician({ firstName: "Alma" }),
        noBlocked
      );
      expect(result.score).toBeLessThan(IDENTITY_THRESHOLDS.REVIEW);
    });

    it("partial first name match + department → stays in scoring range", () => {
      // "Jean-Baptiste" contains "Jean"
      const result = scoreCandidate(
        makeInput({ firstName: "Jean-Baptiste", department: "75" }),
        makePolitician({ firstName: "Jean", departments: ["75"] }),
        noBlocked
      );
      // Partial match: should not be penalized but also not boosted
      expect(result.score).toBeGreaterThanOrEqual(IDENTITY_THRESHOLDS.REVIEW);
    });

    it("exact first name + birthdate match → reaches AUTO_MATCH (SAME)", () => {
      const birthDate = new Date("1990-06-15");
      const result = scoreCandidate(
        makeInput({ firstName: "Alma", birthDate }),
        makePolitician({ firstName: "Alma", birthDate }),
        noBlocked
      );
      expect(result.score).toBeGreaterThanOrEqual(IDENTITY_THRESHOLDS.AUTO_MATCH);
    });

    it("different first name + birthdate match → drops significantly", () => {
      const birthDate = new Date("1990-06-15");
      const result = scoreCandidate(
        makeInput({ firstName: "Marie-Laure", birthDate }),
        makePolitician({ firstName: "Alma", birthDate }),
        noBlocked
      );
      // Even with birthdate match, different first name should penalize heavily
      expect(result.score).toBeLessThan(IDENTITY_THRESHOLDS.REVIEW);
    });

    it("handles accent differences (François vs Francois)", () => {
      const result = scoreCandidate(
        makeInput({ firstName: "François" }),
        makePolitician({ firstName: "Francois" }),
        noBlocked
      );
      expect(result.score).toBeGreaterThanOrEqual(IDENTITY_THRESHOLDS.REVIEW);
    });

    it("handles case differences", () => {
      const result = scoreCandidate(
        makeInput({ firstName: "ALMA" }),
        makePolitician({ firstName: "Alma" }),
        noBlocked
      );
      expect(result.score).toBeGreaterThanOrEqual(IDENTITY_THRESHOLDS.REVIEW);
    });
  });

  describe("regression: mass homonym false positives", () => {
    it("20 different DAvid candidates should NOT match the same politician", () => {
      const politician = makePolitician({
        firstName: "Raphaël",
        lastName: "David",
        departments: ["33"],
      });

      const fakeFirstNames = [
        "Yohan",
        "Michaël",
        "Stéphane",
        "Philippe",
        "Dominique",
        "Bianca",
        "Thérèse",
        "Jacky",
        "Fabien",
        "Thibault",
      ];

      for (const firstName of fakeFirstNames) {
        const result = scoreCandidate(
          makeInput({ firstName, lastName: "David", department: "33" }),
          politician,
          noBlocked
        );
        expect(result.score, `${firstName} David should NOT match Raphaël David`).toBeLessThan(
          IDENTITY_THRESHOLDS.REVIEW
        );
      }
    });

    it("the actual Raphaël David SHOULD match", () => {
      const politician = makePolitician({
        firstName: "Raphaël",
        lastName: "David",
        departments: ["33"],
      });
      const result = scoreCandidate(
        makeInput({ firstName: "Raphaël", lastName: "David", department: "33" }),
        politician,
        noBlocked
      );
      expect(result.score).toBeGreaterThanOrEqual(IDENTITY_THRESHOLDS.REVIEW);
    });
  });

  describe("gender signal", () => {
    it("gender mismatch + dept match → drops below REVIEW (0.85 × 0.3 = 0.255)", () => {
      const result = scoreCandidate(
        makeInput({ firstName: "Dominique", gender: "F" }),
        makePolitician({ firstName: "Dominique", gender: "M" }),
        noBlocked
      );
      // 0.7 (dept) + 0.15 (firstName) = 0.85, × 0.3 (gender) = 0.255
      expect(result.score).toBeCloseTo(0.255, 2);
      expect(result.score).toBeLessThan(IDENTITY_THRESHOLDS.REVIEW);
    });

    it("gender match → same score as no gender (neutral)", () => {
      const withGender = scoreCandidate(
        makeInput({ firstName: "Alma", gender: "F" }),
        makePolitician({ firstName: "Alma", gender: "F" }),
        noBlocked
      );
      const withoutGender = scoreCandidate(
        makeInput({ firstName: "Alma" }),
        makePolitician({ firstName: "Alma" }),
        noBlocked
      );
      expect(withGender.score).toBe(withoutGender.score);
    });

    it("null gender on either side → no change", () => {
      const inputNullGender = scoreCandidate(
        makeInput({ firstName: "Alma", gender: null }),
        makePolitician({ firstName: "Alma", gender: "F" }),
        noBlocked
      );
      const candidateNullGender = scoreCandidate(
        makeInput({ firstName: "Alma", gender: "F" }),
        makePolitician({ firstName: "Alma", gender: null }),
        noBlocked
      );
      const bothNull = scoreCandidate(
        makeInput({ firstName: "Alma" }),
        makePolitician({ firstName: "Alma" }),
        noBlocked
      );
      expect(inputNullGender.score).toBe(bothNull.score);
      expect(candidateNullGender.score).toBe(bothNull.score);
    });

    it("gender mismatch stacks with first name mismatch (×0.4 × 0.3 = ×0.12)", () => {
      const result = scoreCandidate(
        makeInput({ firstName: "Marie-Laure", gender: "F" }),
        makePolitician({ firstName: "Dominique", gender: "M" }),
        noBlocked
      );
      // 0.7 (dept) × 0.4 (firstName mismatch) × 0.3 (gender mismatch) = 0.084
      expect(result.score).toBeCloseTo(0.084, 2);
    });

    it("gender mismatch kills birthdate+firstName match (0.98 × 0.3 = 0.294)", () => {
      const birthDate = new Date("1990-06-15");
      const result = scoreCandidate(
        makeInput({ firstName: "Claude", birthDate, gender: "F" }),
        makePolitician({ firstName: "Claude", birthDate, gender: "M" }),
        noBlocked
      );
      // 0.9 (birthdate) + 0.08 (firstName exact, capped 0.98) = 0.98, × 0.3 = 0.294
      expect(result.score).toBeCloseTo(0.294, 2);
      expect(result.score).toBeLessThan(IDENTITY_THRESHOLDS.REVIEW);
    });
  });

  describe("full enriched flow (RNE birthdate + gender)", () => {
    it("name + dept + birthdate (enriched) + firstName exact + gender match → 0.98 (SAME)", () => {
      const birthDate = new Date("1975-03-12");
      const result = scoreCandidate(
        makeInput({ firstName: "Alma", birthDate, gender: "F" }),
        makePolitician({ firstName: "Alma", birthDate, gender: "F" }),
        noBlocked
      );
      expect(result.score).toBeGreaterThanOrEqual(IDENTITY_THRESHOLDS.AUTO_MATCH);
      expect(result.score).toBe(0.98);
    });

    it("same scenario with gender mismatch → 0.98 × 0.3 = 0.294 (rejected)", () => {
      const birthDate = new Date("1975-03-12");
      const result = scoreCandidate(
        makeInput({ firstName: "Claude", birthDate, gender: "F" }),
        makePolitician({ firstName: "Claude", birthDate, gender: "M" }),
        noBlocked
      );
      expect(result.score).toBeCloseTo(0.294, 2);
      expect(result.score).toBeLessThan(IDENTITY_THRESHOLDS.REVIEW);
    });
  });

  describe("existing behavior preserved", () => {
    it("blocked candidate stays blocked", () => {
      const result = scoreCandidate(makeInput(), makePolitician(), new Set(["pol-1"]));
      expect(result.blocked).toBe(true);
    });

    it("birthdate mismatch → very low score (no dept override)", () => {
      const result = scoreCandidate(
        makeInput({ firstName: "Alma", birthDate: new Date("1990-01-01"), department: undefined }),
        makePolitician({ firstName: "Alma", birthDate: new Date("1970-01-01"), departments: [] }),
        noBlocked
      );
      expect(result.score).toBeLessThan(0.3);
    });

    it("no department, no birthdate → NAME_ONLY base score", () => {
      const result = scoreCandidate(
        makeInput({ firstName: "Alma", department: undefined }),
        makePolitician({ firstName: "Alma", departments: [] }),
        noBlocked
      );
      expect(result.method).toBe(MatchMethod.NAME_ONLY);
    });
  });
});
