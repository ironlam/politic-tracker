import { db } from "./db";

// ============================================
// TYPES
// ============================================

export interface PoliticianName {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  normalizedFullName: string;
  normalizedLastName: string;
}

export interface PartyName {
  id: string;
  name: string;
  shortName: string;
  normalizedName: string;
  normalizedShortName: string;
}

// ============================================
// TEXT UTILITIES
// ============================================

/**
 * Normalize a string for matching (lowercase, remove accents)
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[-–—]/g, " ")
    .trim();
}

/**
 * Escape special regex characters
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ============================================
// EXCLUSION LISTS
// ============================================

/**
 * Common French words to exclude from matching (avoid false positives)
 */
export const EXCLUDED_NAMES = new Set([
  // Common first names
  "paul",
  "jean",
  "pierre",
  "louis",
  "charles",
  "marie",
  "anne",
  // Political / geographic terms
  "fait",
  "gauche",
  "droite",
  "maire",
  "parti",
  "france",
  "etat",
  "nord",
  "sud",
  "est",
  "ouest",
  // Adjectives (colors, size, position)
  "grand",
  "petit",
  "blanc",
  "noir",
  "rouge",
  "vert",
  "bleu",
  "rose",
  "brun",
  "long",
  "court",
  "haut",
  "bas",
  // Nationalities / demonyms (common as adjectives in articles)
  "allemand",
  "anglais",
  "francais",
  "europeen",
  "americain",
  "italien",
  "espagnol",
  // Common verbs / past participles that are also surnames
  "frappe",
  "prevost",
  "marchand",
  "berger",
  "chevalier",
  "fontaine",
  "moulin",
  "richard",
  "martin",
  "moreau",
  "bernard",
  "thomas",
  "robert",
  "simon",
  "michel",
  "laurent",
  "daniel",
  "david",
]);

/**
 * Party short names to exclude (too common or ambiguous)
 */
export const EXCLUDED_PARTY_SHORTNAMES = new Set([
  "lr", // Too common in text (e.g., "la République")
  "ps", // Post-scriptum
  "udi", // Too short
  "dvd", // Digital Versatile Disc
  "dvg", // Too short
]);

// ============================================
// INDEX BUILDERS
// ============================================

/**
 * Build a searchable index of politician names
 */
export async function buildPoliticianIndex(): Promise<PoliticianName[]> {
  const politicians = await db.politician.findMany({
    where: { publicationStatus: "PUBLISHED" },
    select: {
      id: true,
      fullName: true,
      firstName: true,
      lastName: true,
    },
  });

  return politicians.map((p) => ({
    id: p.id,
    fullName: p.fullName,
    firstName: p.firstName,
    lastName: p.lastName,
    normalizedFullName: normalizeText(p.fullName),
    normalizedLastName: normalizeText(p.lastName),
  }));
}

/**
 * Build a searchable index of party names
 */
export async function buildPartyIndex(): Promise<PartyName[]> {
  const parties = await db.party.findMany({
    select: {
      id: true,
      name: true,
      shortName: true,
    },
  });

  return parties.map((p) => ({
    id: p.id,
    name: p.name,
    shortName: p.shortName,
    normalizedName: normalizeText(p.name),
    normalizedShortName: normalizeText(p.shortName),
  }));
}

// ============================================
// MATCHING FUNCTIONS
// ============================================

/**
 * Check if a word at a given position in the original text was part of a
 * hyphenated compound (e.g. "franco-allemand", "Braun-Pivet").
 * We look at the original (non-normalized) text to see if a hyphen preceded or followed the word.
 */
function isPartOfHyphenatedWord(originalText: string, normalizedWord: string): boolean {
  const lowerText = originalText
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  // Match the word with a hyphen immediately before or after
  const hyphenatedRegex = new RegExp(
    `[\\w][-–—]${escapeRegex(normalizedWord)}\\b|\\b${escapeRegex(normalizedWord)}[-–—][\\w]`
  );
  return hyphenatedRegex.test(lowerText);
}

/**
 * Find politicians mentioned in text
 * Returns matches with the name that was found
 */
export function findMentions(
  text: string,
  politicians: PoliticianName[]
): Array<{ politicianId: string; matchedName: string }> {
  const normalizedText = normalizeText(text);
  const matches: Array<{ politicianId: string; matchedName: string }> = [];
  const seenIds = new Set<string>();

  // Sort politicians by full name length (longer names first for more specific matches)
  const sortedPoliticians = [...politicians].sort(
    (a, b) => b.normalizedFullName.length - a.normalizedFullName.length
  );

  for (const politician of sortedPoliticians) {
    if (seenIds.has(politician.id)) continue;

    // Try full name first (more specific)
    const fullNameRegex = new RegExp(`\\b${escapeRegex(politician.normalizedFullName)}\\b`);
    if (fullNameRegex.test(normalizedText)) {
      matches.push({
        politicianId: politician.id,
        matchedName: politician.fullName,
      });
      seenIds.add(politician.id);
      continue;
    }

    // Try last name only (less specific, but catches more mentions)
    // Only match if last name is at least 5 characters (avoid false positives)
    // AND last name is not a common word
    // AND the word is not part of a hyphenated compound in the original text
    if (
      politician.normalizedLastName.length >= 5 &&
      !EXCLUDED_NAMES.has(politician.normalizedLastName)
    ) {
      const lastNameRegex = new RegExp(`\\b${escapeRegex(politician.normalizedLastName)}\\b`);
      if (
        lastNameRegex.test(normalizedText) &&
        !isPartOfHyphenatedWord(text, politician.normalizedLastName)
      ) {
        matches.push({
          politicianId: politician.id,
          matchedName: politician.lastName,
        });
        seenIds.add(politician.id);
      }
    }
  }

  return matches;
}

/**
 * Find parties mentioned in text
 * Returns matches with the name that was found
 */
export function findPartyMentions(
  text: string,
  parties: PartyName[]
): Array<{ partyId: string; matchedName: string }> {
  const normalizedText = normalizeText(text);
  const matches: Array<{ partyId: string; matchedName: string }> = [];
  const seenIds = new Set<string>();

  // Sort parties by full name length (longer names first for more specific matches)
  const sortedParties = [...parties].sort(
    (a, b) => b.normalizedName.length - a.normalizedName.length
  );

  for (const party of sortedParties) {
    if (seenIds.has(party.id)) continue;

    // Try full name first (more specific)
    const fullNameRegex = new RegExp(`\\b${escapeRegex(party.normalizedName)}\\b`);
    if (fullNameRegex.test(normalizedText)) {
      matches.push({
        partyId: party.id,
        matchedName: party.name,
      });
      seenIds.add(party.id);
      continue;
    }

    // Try short name (only if >= 3 characters to avoid false positives)
    // AND not in excluded list
    if (
      party.normalizedShortName.length >= 3 &&
      !EXCLUDED_PARTY_SHORTNAMES.has(party.normalizedShortName)
    ) {
      const shortNameRegex = new RegExp(`\\b${escapeRegex(party.normalizedShortName)}\\b`);
      if (shortNameRegex.test(normalizedText)) {
        matches.push({
          partyId: party.id,
          matchedName: party.shortName,
        });
        seenIds.add(party.id);
      }
    }
  }

  return matches;
}
