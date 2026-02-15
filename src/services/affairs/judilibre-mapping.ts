/**
 * Judilibre → Affair Mapping Service
 *
 * Maps Cour de cassation decisions to our affair model:
 * - solution → AffairStatus (pourvoi rejeté = condamnation confirmée)
 * - themes/summary → AffairCategory
 * - text analysis → conviction detection
 */

import type { AffairStatus, AffairCategory } from "@/generated/prisma";
import type { JudilibreDecision, JudilibreDecisionSummary } from "@/lib/api/judilibre";
import { CRIME_CATEGORY_MAP } from "@/services/sync/wikidata-affairs";

// ============================================
// SOLUTION → STATUS
// ============================================

/**
 * Map Judilibre "solution" field to AffairStatus.
 *
 * La Cour de cassation ne condamne pas directement — elle statue sur les pourvois.
 * - Pourvoi rejeté → la condamnation en appel est définitive
 * - Cassation → renvoi pour nouveau procès (conservateur: APPEL_EN_COURS)
 */
export function mapSolutionToStatus(solution: string): AffairStatus {
  const normalized = solution.toLowerCase().trim();

  // Pourvoi rejeté = condamnation confirmée définitivement
  if (
    normalized.includes("rejet") ||
    normalized.includes("irrecevabilité") ||
    normalized.includes("non-admission") ||
    normalized.includes("déchéance") ||
    normalized.includes("désistement")
  ) {
    return "CONDAMNATION_DEFINITIVE";
  }

  // Cassation = renvoi pour nouveau procès → conservateur
  if (normalized.includes("cassation")) {
    return "APPEL_EN_COURS";
  }

  // Cassation partielle — mixed result, conservateur
  if (normalized.includes("cassation partielle")) {
    return "APPEL_EN_COURS";
  }

  // Défaut / inconnu → procès en cours
  return "PROCES_EN_COURS";
}

// ============================================
// THEMES/SUMMARY → CATEGORY
// ============================================

/**
 * Map Judilibre themes and summary to AffairCategory.
 * Reuses CRIME_CATEGORY_MAP from wikidata-affairs for consistency.
 */
export function mapJudilibreToCategory(themes: string[], summary: string): AffairCategory {
  const searchText = [...themes, summary].join(" ").toLowerCase();

  // Sort by length (descending) to match more specific terms first
  const sortedEntries = Object.entries(CRIME_CATEGORY_MAP).sort(
    (a, b) => b[0].length - a[0].length
  );

  for (const [key, category] of sortedEntries) {
    if (searchText.includes(key)) {
      return category;
    }
  }

  return "AUTRE";
}

// ============================================
// CONVICTION ANALYSIS
// ============================================

/** Keywords indicating a conviction in decision text */
const CONVICTION_KEYWORDS = [
  "condamné",
  "condamnée",
  "condamnation",
  "coupable",
  "déclaré coupable",
  "déclarée coupable",
  "peine",
  "emprisonnement",
  "prison",
  "amende",
  "réclusion",
  "inéligibilité",
  "interdiction",
];

/**
 * Analyze whether a Cour de cassation decision confirms a conviction.
 *
 * La Cour de cassation ne condamne pas directement :
 * - Pourvoi rejeté + texte mentions condamnation → conviction
 * - Cassation → pas conviction (renvoi)
 */
export function analyzeIfConviction(
  decision: JudilibreDecision | JudilibreDecisionSummary
): boolean {
  const solution = decision.solution.toLowerCase();

  // Cassation = pas de conviction (renvoi pour nouveau procès)
  if (solution.includes("cassation")) {
    return false;
  }

  // Rejet / irrecevabilité / non-admission → check text for conviction
  const isRejection =
    solution.includes("rejet") ||
    solution.includes("irrecevabilité") ||
    solution.includes("non-admission") ||
    solution.includes("déchéance");

  if (!isRejection) {
    return false;
  }

  // Check decision text or summary for conviction keywords
  const text = "text" in decision ? decision.text.toLowerCase() : "";
  const searchText = `${text} ${decision.summary.toLowerCase()}`;

  return CONVICTION_KEYWORDS.some((keyword) => searchText.includes(keyword));
}

/**
 * Build a descriptive title from a Judilibre decision
 */
export function buildTitleFromDecision(decision: JudilibreDecisionSummary): string {
  const category = mapJudilibreToCategory(decision.themes, decision.summary);

  // Use category label if recognized, otherwise use first theme
  if (category !== "AUTRE") {
    return categoryToLabel(category);
  }

  if (decision.themes.length > 0) {
    const theme = decision.themes[0];
    return theme.charAt(0).toUpperCase() + theme.slice(1);
  }

  return `Décision Cour de cassation (${decision.solution})`;
}

/** Map AffairCategory to human-readable French label */
function categoryToLabel(category: AffairCategory): string {
  const labels: Partial<Record<AffairCategory, string>> = {
    CORRUPTION: "Corruption",
    CORRUPTION_PASSIVE: "Corruption passive",
    TRAFIC_INFLUENCE: "Trafic d'influence",
    PRISE_ILLEGALE_INTERETS: "Prise illégale d'intérêts",
    FAVORITISME: "Favoritisme",
    DETOURNEMENT_FONDS_PUBLICS: "Détournement de fonds publics",
    FRAUDE_FISCALE: "Fraude fiscale",
    BLANCHIMENT: "Blanchiment",
    ABUS_BIENS_SOCIAUX: "Abus de biens sociaux",
    ABUS_CONFIANCE: "Abus de confiance",
    EMPLOI_FICTIF: "Emploi fictif",
    FINANCEMENT_ILLEGAL_CAMPAGNE: "Financement illégal de campagne",
    FINANCEMENT_ILLEGAL_PARTI: "Financement illégal de parti",
    HARCELEMENT_MORAL: "Harcèlement moral",
    HARCELEMENT_SEXUEL: "Harcèlement sexuel",
    AGRESSION_SEXUELLE: "Agression sexuelle",
    VIOLENCE: "Violence",
    MENACE: "Menace",
    DIFFAMATION: "Diffamation",
    INJURE: "Injure",
    INCITATION_HAINE: "Incitation à la haine",
    FAUX_ET_USAGE_FAUX: "Faux et usage de faux",
    RECEL: "Recel",
    CONFLIT_INTERETS: "Conflit d'intérêts",
  };

  return labels[category] ?? "Autre infraction";
}
