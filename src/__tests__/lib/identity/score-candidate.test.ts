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
