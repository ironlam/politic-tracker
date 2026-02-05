import { describe, it, expect } from "vitest";
import {
  isReasonableYear,
  isValidDate,
  parseFrenchDate,
  parseWikidataDate,
  parsePartialISO,
  parseDate,
  formatDateFR,
  formatDateISO,
  extractYear,
} from "./date-utils";

describe("isReasonableYear", () => {
  it("should accept years within valid range (1800-2100)", () => {
    expect(isReasonableYear(1800)).toBe(true);
    expect(isReasonableYear(1900)).toBe(true);
    expect(isReasonableYear(2024)).toBe(true);
    expect(isReasonableYear(2100)).toBe(true);
  });

  it("should reject years outside valid range", () => {
    expect(isReasonableYear(1799)).toBe(false);
    expect(isReasonableYear(2101)).toBe(false);
    expect(isReasonableYear(0)).toBe(false);
    expect(isReasonableYear(-500)).toBe(false);
  });
});

describe("isValidDate", () => {
  it("should return true for valid Date objects", () => {
    expect(isValidDate(new Date(2024, 0, 15))).toBe(true);
    expect(isValidDate(new Date("2024-01-15"))).toBe(true);
  });

  it("should return false for Invalid Date", () => {
    expect(isValidDate(new Date("invalid"))).toBe(false);
    expect(isValidDate(new Date(NaN))).toBe(false);
  });
});

describe("parseFrenchDate", () => {
  it("should parse standard French dates", () => {
    const date = parseFrenchDate("15 janvier 2024");
    expect(date).not.toBeNull();
    expect(date?.getFullYear()).toBe(2024);
    expect(date?.getMonth()).toBe(0); // January
    expect(date?.getDate()).toBe(15);
  });

  it("should parse dates with 'er' suffix (1er)", () => {
    const date = parseFrenchDate("1er mars 2020");
    expect(date).not.toBeNull();
    expect(date?.getFullYear()).toBe(2020);
    expect(date?.getMonth()).toBe(2); // March
    expect(date?.getDate()).toBe(1);
  });

  it("should handle uppercase input", () => {
    const date = parseFrenchDate("15 JANVIER 2024");
    expect(date).not.toBeNull();
    expect(date?.getMonth()).toBe(0);
  });

  it("should handle months without accents", () => {
    expect(parseFrenchDate("15 fevrier 2024")?.getMonth()).toBe(1);
    expect(parseFrenchDate("15 aout 2024")?.getMonth()).toBe(7);
    expect(parseFrenchDate("15 decembre 2024")?.getMonth()).toBe(11);
  });

  it("should handle months with accents", () => {
    expect(parseFrenchDate("15 février 2024")?.getMonth()).toBe(1);
    expect(parseFrenchDate("15 août 2024")?.getMonth()).toBe(7);
    expect(parseFrenchDate("15 décembre 2024")?.getMonth()).toBe(11);
  });

  it("should return null for invalid inputs", () => {
    expect(parseFrenchDate(null)).toBeNull();
    expect(parseFrenchDate(undefined)).toBeNull();
    expect(parseFrenchDate("")).toBeNull();
    expect(parseFrenchDate("invalid date")).toBeNull();
    expect(parseFrenchDate("15 invalid 2024")).toBeNull();
  });

  it("should return null for unreasonable years", () => {
    expect(parseFrenchDate("15 janvier 1700")).toBeNull();
    expect(parseFrenchDate("15 janvier 2200")).toBeNull();
  });

  it("should return null for invalid days", () => {
    expect(parseFrenchDate("0 janvier 2024")).toBeNull();
    expect(parseFrenchDate("32 janvier 2024")).toBeNull();
  });
});

describe("parseWikidataDate", () => {
  it("should parse standard Wikidata dates with + prefix", () => {
    const date = parseWikidataDate("+1977-12-21T00:00:00Z");
    expect(date).not.toBeNull();
    expect(date?.getFullYear()).toBe(1977);
    expect(date?.getMonth()).toBe(11); // December
    expect(date?.getDate()).toBe(21);
  });

  it("should parse Wikidata dates without prefix", () => {
    const date = parseWikidataDate("1977-12-21T00:00:00Z");
    expect(date).not.toBeNull();
    expect(date?.getFullYear()).toBe(1977);
  });

  it("should return null for invalid inputs", () => {
    expect(parseWikidataDate(null)).toBeNull();
    expect(parseWikidataDate(undefined)).toBeNull();
    expect(parseWikidataDate("")).toBeNull();
  });
});

describe("parsePartialISO", () => {
  it("should parse complete ISO dates", () => {
    const date = parsePartialISO("1977-12-21");
    expect(date).not.toBeNull();
    expect(date?.getFullYear()).toBe(1977);
    expect(date?.getMonth()).toBe(11);
    expect(date?.getDate()).toBe(21);
  });

  it("should handle partial dates with 00 month (defaults to January)", () => {
    const date = parsePartialISO("1977-00-00");
    expect(date).not.toBeNull();
    expect(date?.getFullYear()).toBe(1977);
    expect(date?.getMonth()).toBe(0); // January
    expect(date?.getDate()).toBe(1);
  });

  it("should handle partial dates with 00 day (defaults to 1st)", () => {
    const date = parsePartialISO("1977-06-00");
    expect(date).not.toBeNull();
    expect(date?.getFullYear()).toBe(1977);
    expect(date?.getMonth()).toBe(5); // June
    expect(date?.getDate()).toBe(1);
  });

  it("should handle year-only dates", () => {
    const date = parsePartialISO("1977");
    expect(date).not.toBeNull();
    expect(date?.getFullYear()).toBe(1977);
    expect(date?.getMonth()).toBe(0);
    expect(date?.getDate()).toBe(1);
  });

  it("should clamp invalid month values", () => {
    const date = parsePartialISO("1977-15-01");
    expect(date).not.toBeNull();
    expect(date?.getMonth()).toBe(11); // Clamped to December
  });

  it("should return null for invalid inputs", () => {
    expect(parsePartialISO(null)).toBeNull();
    expect(parsePartialISO(undefined)).toBeNull();
    expect(parsePartialISO("")).toBeNull();
  });

  it("should return null for unreasonable years", () => {
    expect(parsePartialISO("1700-01-01")).toBeNull();
    expect(parsePartialISO("2200-01-01")).toBeNull();
  });
});

describe("parseDate", () => {
  it("should auto-detect ISO format", () => {
    const date = parseDate("2024-01-15");
    expect(date).not.toBeNull();
    expect(date?.getFullYear()).toBe(2024);
    expect(date?.getMonth()).toBe(0);
    expect(date?.getDate()).toBe(15);
  });

  it("should auto-detect Wikidata format", () => {
    const date = parseDate("+1977-12-21T00:00:00Z");
    expect(date).not.toBeNull();
    expect(date?.getFullYear()).toBe(1977);
  });

  it("should auto-detect French format", () => {
    const date = parseDate("15 janvier 2024");
    expect(date).not.toBeNull();
    expect(date?.getFullYear()).toBe(2024);
    expect(date?.getMonth()).toBe(0);
  });

  it("should handle year-only format", () => {
    const date = parseDate("1977");
    expect(date).not.toBeNull();
    expect(date?.getFullYear()).toBe(1977);
  });

  it("should handle year-month format", () => {
    const date = parseDate("1977-06");
    expect(date).not.toBeNull();
    expect(date?.getFullYear()).toBe(1977);
    expect(date?.getMonth()).toBe(5);
  });

  it("should return null for invalid inputs", () => {
    expect(parseDate(null)).toBeNull();
    expect(parseDate(undefined)).toBeNull();
    expect(parseDate("")).toBeNull();
    expect(parseDate("completely invalid")).toBeNull();
  });

  it("should handle whitespace", () => {
    const date = parseDate("  2024-01-15  ");
    expect(date).not.toBeNull();
    expect(date?.getFullYear()).toBe(2024);
  });
});

describe("formatDateFR", () => {
  it("should format date in French locale", () => {
    const date = new Date(2024, 0, 15);
    expect(formatDateFR(date)).toBe("15 janvier 2024");
  });

  it("should handle all months correctly", () => {
    expect(formatDateFR(new Date(2024, 0, 1))).toContain("janvier");
    expect(formatDateFR(new Date(2024, 1, 1))).toContain("février");
    expect(formatDateFR(new Date(2024, 2, 1))).toContain("mars");
    expect(formatDateFR(new Date(2024, 3, 1))).toContain("avril");
    expect(formatDateFR(new Date(2024, 4, 1))).toContain("mai");
    expect(formatDateFR(new Date(2024, 5, 1))).toContain("juin");
    expect(formatDateFR(new Date(2024, 6, 1))).toContain("juillet");
    expect(formatDateFR(new Date(2024, 7, 1))).toContain("août");
    expect(formatDateFR(new Date(2024, 8, 1))).toContain("septembre");
    expect(formatDateFR(new Date(2024, 9, 1))).toContain("octobre");
    expect(formatDateFR(new Date(2024, 10, 1))).toContain("novembre");
    expect(formatDateFR(new Date(2024, 11, 1))).toContain("décembre");
  });

  it("should return empty string for invalid dates", () => {
    expect(formatDateFR(new Date("invalid"))).toBe("");
  });
});

describe("formatDateISO", () => {
  it("should format date in ISO format", () => {
    const date = new Date(2024, 0, 15);
    expect(formatDateISO(date)).toBe("2024-01-15");
  });

  it("should pad single-digit months and days", () => {
    const date = new Date(2024, 0, 5);
    expect(formatDateISO(date)).toBe("2024-01-05");
  });

  it("should return empty string for invalid dates", () => {
    expect(formatDateISO(new Date("invalid"))).toBe("");
  });
});

describe("extractYear", () => {
  it("should extract year from various formats", () => {
    expect(extractYear("2024-01-15")).toBe(2024);
    expect(extractYear("+1977-12-21T00:00:00Z")).toBe(1977);
    expect(extractYear("15 janvier 2024")).toBe(2024);
    expect(extractYear("1977")).toBe(1977);
  });

  it("should return null for invalid inputs", () => {
    expect(extractYear(null)).toBeNull();
    expect(extractYear(undefined)).toBeNull();
    expect(extractYear("")).toBeNull();
    expect(extractYear("no year here")).toBeNull();
  });

  it("should return null for unreasonable years", () => {
    expect(extractYear("1700-01-01")).toBeNull();
    expect(extractYear("year is 0500")).toBeNull();
  });
});
