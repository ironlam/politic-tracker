/**
 * Judicial keywords for press article pre-filtering.
 *
 * Articles matching these keywords in title or description are classified as
 * TIER_1 and analyzed with Sonnet 4.5 (higher precision, higher cost).
 * Remaining articles are TIER_2, analyzed with Haiku 4.5.
 */

export type ArticleTier = "TIER_1" | "TIER_2";

/**
 * Judicial keywords organized by category.
 * Matching is case-insensitive and accent-insensitive.
 */

// Procédure pénale
const PROCEDURE_KEYWORDS = [
  "mis en examen",
  "mise en examen",
  "condamne",
  "condamnee",
  "condamnation",
  "renvoye devant",
  "poursuivi",
  "poursuivie",
  "garde a vue",
  "perquisition",
  "tribunal correctionnel",
  "proces",
  "relaxe",
  "relaxee",
  "acquitte",
  "acquittee",
  "juge",
  "jugee",
  "inculpe",
  "inculpee",
  "ecroue",
  "ecrouee",
  "detention",
  "mandat d'arret",
  "controle judiciaire",
];

// Infractions
const INFRACTION_KEYWORDS = [
  "detournement",
  "corruption",
  "fraude",
  "abus de bien",
  "prise illegale",
  "favoritisme",
  "harcelement",
  "agression sexuelle",
  "viol",
  "blanchiment",
  "emploi fictif",
  "conflit d'interets",
  "trafic d'influence",
];

// Juridictions
const JURISDICTION_KEYWORDS = [
  "cour d'appel",
  "cour de cassation",
  "tribunal",
  "parquet",
  "pnf",
  "procureur",
];

/** All judicial keywords (already normalized — no accents, lowercase) */
export const JUDICIAL_KEYWORDS: string[] = [
  ...PROCEDURE_KEYWORDS,
  ...INFRACTION_KEYWORDS,
  ...JURISDICTION_KEYWORDS,
];

/**
 * Normalize text for keyword matching:
 * lowercase, strip accents, normalize whitespace
 */
function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[\u2018\u2019']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Classify an article as TIER_1 (judicial keywords found) or TIER_2 (no match).
 * Matching is case-insensitive and accent-insensitive on title + description.
 */
export function classifyArticleTier(
  title: string,
  description: string | null
): ArticleTier {
  const text = normalizeForMatching(`${title} ${description || ""}`);

  for (const keyword of JUDICIAL_KEYWORDS) {
    if (text.includes(keyword)) {
      return "TIER_1";
    }
  }

  return "TIER_2";
}
