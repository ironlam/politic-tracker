import { describe, it, expect } from "vitest";
import { findCourtDepartments, extractJurisdictionName } from "./judilibre-courts";

describe("findCourtDepartments", () => {
  it("returns departments for known courts", () => {
    expect(findCourtDepartments("Paris")).toContain("Paris");
    expect(findCourtDepartments("Lyon")).toContain("Rhône");
    expect(findCourtDepartments("Bordeaux")).toContain("Gironde");
  });

  it("returns null for unknown courts", () => {
    expect(findCourtDepartments("Tombouctou")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(findCourtDepartments("paris")).toContain("Paris");
    expect(findCourtDepartments("LYON")).toContain("Rhône");
  });
});

describe("extractJurisdictionName", () => {
  it("extracts court name from 'Cour d'appel de X' pattern", () => {
    expect(extractJurisdictionName("arrêt de la cour d'appel de Lyon")).toBe("Lyon");
    expect(extractJurisdictionName("rendu par la cour d'appel de Bordeaux")).toBe("Bordeaux");
  });

  it("extracts court name from 'tribunal de X' pattern", () => {
    expect(extractJurisdictionName("tribunal correctionnel de Paris")).toBe("Paris");
    expect(extractJurisdictionName("tribunal judiciaire de Marseille")).toBe("Marseille");
  });

  it("returns null when no jurisdiction found", () => {
    expect(extractJurisdictionName("texte sans juridiction")).toBeNull();
  });

  it("handles accented city names", () => {
    expect(extractJurisdictionName("cour d'appel d'Orléans")).toBe("Orléans");
  });

  it("handles hyphenated city names", () => {
    expect(extractJurisdictionName("cour d'appel d'Aix-en-Provence")).toBe("Aix-en-Provence");
  });

  it("handles Fort-de-France", () => {
    expect(extractJurisdictionName("cour d'appel de Fort-de-France")).toBe("Fort-de-France");
  });
});
