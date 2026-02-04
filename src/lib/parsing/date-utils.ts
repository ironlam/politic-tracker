/**
 * Date parsing utilities
 *
 * Consolidates all date parsing logic used across sync scripts:
 * - French dates ("15 janvier 2024")
 * - Wikidata dates ("+1977-12-21T00:00:00Z")
 * - Partial ISO dates ("1977-00-00")
 * - Standard ISO dates ("2024-01-15")
 */

/**
 * French month names to month index (0-based)
 */
const FRENCH_MONTHS = {
  janvier: 0,
  février: 1,
  fevrier: 1, // Without accent
  mars: 2,
  avril: 3,
  mai: 4,
  juin: 5,
  juillet: 6,
  août: 7,
  aout: 7, // Without accent
  septembre: 8,
  octobre: 9,
  novembre: 10,
  décembre: 11,
  decembre: 11, // Without accent
} as const satisfies Record<string, number>;

/**
 * French month names for formatting (index to name)
 */
const MONTH_NAMES_FR = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
] as const;

/**
 * Check if a year is reasonable (for politician data)
 */
export function isReasonableYear(year: number): boolean {
  return year >= 1800 && year <= 2100;
}

/**
 * Check if a Date object is valid
 */
export function isValidDate(date: Date): boolean {
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Parse a French date string
 *
 * @example
 * parseFrenchDate("15 janvier 2024") // Date(2024, 0, 15)
 * parseFrenchDate("1er mars 2020") // Date(2020, 2, 1)
 */
export function parseFrenchDate(input: string | null | undefined): Date | null {
  if (!input) return null;

  const normalized = input.toLowerCase().trim();

  // Pattern: "15 janvier 2024" or "1er mars 2020"
  const match = normalized.match(/(\d{1,2})(?:er)?\s+(\w+)\s+(\d{4})/);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const monthName = match[2];
  const year = parseInt(match[3], 10);

  const month = (FRENCH_MONTHS as Record<string, number>)[monthName];
  if (month === undefined) return null;

  if (!isReasonableYear(year)) return null;
  if (day < 1 || day > 31) return null;

  const date = new Date(year, month, day);
  return isValidDate(date) ? date : null;
}

/**
 * Parse a Wikidata date string
 *
 * Wikidata uses ISO 8601 with a leading + or -
 *
 * @example
 * parseWikidataDate("+1977-12-21T00:00:00Z") // Date(1977, 11, 21)
 * parseWikidataDate("-0044-03-15T00:00:00Z") // Date(-44, 2, 15) - Julius Caesar
 */
export function parseWikidataDate(input: string | null | undefined): Date | null {
  if (!input) return null;

  // Remove leading + and extract date part
  const dateStr = input.replace(/^[+-]/, "").split("T")[0];
  return parsePartialISO(dateStr);
}

/**
 * Parse a partial ISO date string
 *
 * Handles incomplete dates where month or day may be 00
 *
 * @example
 * parsePartialISO("1977-12-21") // Date(1977, 11, 21)
 * parsePartialISO("1977-00-00") // Date(1977, 0, 1) - January 1st
 * parsePartialISO("1977-06-00") // Date(1977, 5, 1) - June 1st
 */
export function parsePartialISO(input: string | null | undefined): Date | null {
  if (!input) return null;

  const parts = input.split("-");
  if (parts.length < 1) return null;

  const year = parseInt(parts[0], 10);
  const month = parts[1] ? parseInt(parts[1], 10) || 1 : 1;
  const day = parts[2] ? parseInt(parts[2], 10) || 1 : 1;

  if (!isReasonableYear(year)) return null;

  // Clamp month to valid range
  const validMonth = Math.max(1, Math.min(12, month));
  // Clamp day to valid range
  const validDay = Math.max(1, Math.min(31, day));

  const date = new Date(year, validMonth - 1, validDay);
  return isValidDate(date) ? date : null;
}

/**
 * Parse any date format (auto-detection)
 *
 * Tries multiple formats in order:
 * 1. ISO format (2024-01-15)
 * 2. French format (15 janvier 2024)
 * 3. Wikidata format (+1977-12-21T00:00:00Z)
 */
export function parseDate(input: string | null | undefined): Date | null {
  if (!input) return null;

  const trimmed = input.trim();

  // Try ISO format first (most common)
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return parsePartialISO(trimmed);
  }

  // Try Wikidata format
  if (/^[+-]?\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    return parseWikidataDate(trimmed);
  }

  // Try French format
  if (/\d{1,2}(?:er)?\s+\w+\s+\d{4}/.test(trimmed)) {
    return parseFrenchDate(trimmed);
  }

  // Try partial ISO (year only or year-month)
  if (/^\d{4}(-\d{2})?$/.test(trimmed)) {
    return parsePartialISO(trimmed);
  }

  // Try native Date parsing as fallback
  const nativeDate = new Date(trimmed);
  if (isValidDate(nativeDate) && isReasonableYear(nativeDate.getFullYear())) {
    return nativeDate;
  }

  return null;
}

/**
 * Format a Date to French locale string
 *
 * @example
 * formatDateFR(new Date(2024, 0, 15)) // "15 janvier 2024"
 */
export function formatDateFR(date: Date): string {
  if (!isValidDate(date)) return "";

  const day = date.getDate();
  const month = MONTH_NAMES_FR[date.getMonth()];
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
}

/**
 * Format a Date to ISO string (date only)
 *
 * @example
 * formatDateISO(new Date(2024, 0, 15)) // "2024-01-15"
 */
export function formatDateISO(date: Date): string {
  if (!isValidDate(date)) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Extract year from a date string without full parsing
 *
 * Useful for quick filtering before expensive operations
 */
export function extractYear(input: string | null | undefined): number | null {
  if (!input) return null;

  const match = input.match(/\d{4}/);
  if (!match) return null;

  const year = parseInt(match[0], 10);
  return isReasonableYear(year) ? year : null;
}
