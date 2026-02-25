import { describe, it, expect, vi } from "vitest";

// Mock database to avoid DATABASE_URL requirement
vi.mock("@/lib/db", () => ({ db: {} }));

import { shouldUpdateStatus, checkJurisdictionMatch } from "./judilibre";

describe("shouldUpdateStatus", () => {
  // Normal upgrades (existing behavior)
  it("allows upgrade from lower to higher severity", () => {
    expect(shouldUpdateStatus("ENQUETE_PRELIMINAIRE", "MISE_EN_EXAMEN")).toBe(true);
    expect(shouldUpdateStatus("MISE_EN_EXAMEN", "PROCES_EN_COURS")).toBe(true);
    expect(shouldUpdateStatus("PROCES_EN_COURS", "CONDAMNATION_PREMIERE_INSTANCE")).toBe(true);
  });

  it("blocks normal downgrades", () => {
    expect(shouldUpdateStatus("CONDAMNATION_PREMIERE_INSTANCE", "ENQUETE_PRELIMINAIRE")).toBe(
      false
    );
    expect(shouldUpdateStatus("MISE_EN_EXAMEN", "INSTRUCTION")).toBe(false);
  });

  it("blocks same status", () => {
    expect(shouldUpdateStatus("RELAXE", "RELAXE")).toBe(false);
    expect(shouldUpdateStatus("MISE_EN_EXAMEN", "MISE_EN_EXAMEN")).toBe(false);
  });

  // Terminal status transitions (new behavior)
  it("allows terminal status from any non-terminal state", () => {
    expect(shouldUpdateStatus("CONDAMNATION_PREMIERE_INSTANCE", "RELAXE")).toBe(true);
    expect(shouldUpdateStatus("APPEL_EN_COURS", "ACQUITTEMENT")).toBe(true);
    expect(shouldUpdateStatus("MISE_EN_EXAMEN", "NON_LIEU")).toBe(true);
    expect(shouldUpdateStatus("PROCES_EN_COURS", "CLASSEMENT_SANS_SUITE")).toBe(true);
    expect(shouldUpdateStatus("ENQUETE_PRELIMINAIRE", "PRESCRIPTION")).toBe(true);
  });

  // CONDAMNATION_DEFINITIVE guard
  it("blocks downgrade from CONDAMNATION_DEFINITIVE", () => {
    expect(shouldUpdateStatus("CONDAMNATION_DEFINITIVE", "RELAXE")).toBe(false);
    expect(shouldUpdateStatus("CONDAMNATION_DEFINITIVE", "ACQUITTEMENT")).toBe(false);
    expect(shouldUpdateStatus("CONDAMNATION_DEFINITIVE", "NON_LIEU")).toBe(false);
  });

  // Terminal-to-terminal (already resolved)
  it("blocks terminal-to-terminal transitions", () => {
    expect(shouldUpdateStatus("RELAXE", "ACQUITTEMENT")).toBe(false);
    expect(shouldUpdateStatus("NON_LIEU", "PRESCRIPTION")).toBe(false);
  });
});

describe("checkJurisdictionMatch", () => {
  it("returns match when politician department matches court jurisdiction", () => {
    const result = checkJurisdictionMatch("arrêt de la cour d'appel de Lyon", ["Rhône", "Paris"]);
    expect(result).toEqual({ match: true, jurisdiction: "Lyon" });
  });

  it("returns mismatch when politician has no matching department", () => {
    const result = checkJurisdictionMatch("arrêt de la cour d'appel de Bordeaux", ["Rhône"]);
    expect(result).toEqual({ match: false, jurisdiction: "Bordeaux" });
  });

  it("returns unknown when no jurisdiction found in text", () => {
    const result = checkJurisdictionMatch("texte sans juridiction", ["Rhône"]);
    expect(result).toEqual({ match: "unknown", jurisdiction: null });
  });

  it("returns unknown when politician has no departments", () => {
    const result = checkJurisdictionMatch("arrêt de la cour d'appel de Lyon", []);
    expect(result).toEqual({ match: "unknown", jurisdiction: "Lyon" });
  });

  it("returns unknown when court is not in mapping table", () => {
    const result = checkJurisdictionMatch("tribunal correctionnel de Tombouctou", ["Paris"]);
    expect(result).toEqual({ match: "unknown", jurisdiction: "Tombouctou" });
  });
});
