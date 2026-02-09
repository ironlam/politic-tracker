import type {
  AffairStatus,
  AffairCategory,
  MandateType,
  DataSource,
  PoliticalPosition,
  AffairEventType,
  VotePosition,
  VotingResult,
  Chamber,
  FactCheckRating,
  PartyRole,
  ThemeCategory,
} from "@/types";

export const AFFAIR_STATUS_LABELS: Record<AffairStatus, string> = {
  ENQUETE_PRELIMINAIRE: "Enquête préliminaire",
  INSTRUCTION: "Instruction en cours",
  MISE_EN_EXAMEN: "Mise en examen",
  RENVOI_TRIBUNAL: "Renvoi devant le tribunal",
  PROCES_EN_COURS: "Procès en cours",
  CONDAMNATION_PREMIERE_INSTANCE: "Condamnation (1ère instance)",
  APPEL_EN_COURS: "Appel en cours",
  CONDAMNATION_DEFINITIVE: "Condamnation définitive",
  RELAXE: "Relaxe",
  ACQUITTEMENT: "Acquittement",
  NON_LIEU: "Non-lieu",
  PRESCRIPTION: "Prescription",
  CLASSEMENT_SANS_SUITE: "Classement sans suite",
};

export const AFFAIR_STATUS_COLORS: Record<AffairStatus, string> = {
  ENQUETE_PRELIMINAIRE: "bg-yellow-100 text-yellow-800",
  INSTRUCTION: "bg-yellow-100 text-yellow-800",
  MISE_EN_EXAMEN: "bg-orange-100 text-orange-800",
  RENVOI_TRIBUNAL: "bg-orange-100 text-orange-800",
  PROCES_EN_COURS: "bg-orange-100 text-orange-800",
  CONDAMNATION_PREMIERE_INSTANCE: "bg-red-100 text-red-800",
  APPEL_EN_COURS: "bg-orange-100 text-orange-800",
  CONDAMNATION_DEFINITIVE: "bg-red-200 text-red-900",
  RELAXE: "bg-green-100 text-green-800",
  ACQUITTEMENT: "bg-green-100 text-green-800",
  NON_LIEU: "bg-gray-100 text-gray-800",
  PRESCRIPTION: "bg-gray-100 text-gray-800",
  CLASSEMENT_SANS_SUITE: "bg-gray-100 text-gray-800",
};

// Indicates if presumption of innocence reminder is needed
export const AFFAIR_STATUS_NEEDS_PRESUMPTION: Record<AffairStatus, boolean> = {
  ENQUETE_PRELIMINAIRE: true,
  INSTRUCTION: true,
  MISE_EN_EXAMEN: true,
  RENVOI_TRIBUNAL: true,
  PROCES_EN_COURS: true,
  CONDAMNATION_PREMIERE_INSTANCE: true, // Can still appeal
  APPEL_EN_COURS: true,
  CONDAMNATION_DEFINITIVE: false,
  RELAXE: false,
  ACQUITTEMENT: false,
  NON_LIEU: false,
  PRESCRIPTION: false,
  CLASSEMENT_SANS_SUITE: false,
};

export const AFFAIR_CATEGORY_LABELS: Record<AffairCategory, string> = {
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
  AUTRE: "Autre",
};

// Super-categories for grouping
export type AffairSuperCategory = "PROBITE" | "FINANCES" | "PERSONNES" | "EXPRESSION" | "AUTRE";

export const AFFAIR_SUPER_CATEGORY_LABELS: Record<AffairSuperCategory, string> = {
  PROBITE: "Atteintes à la probité",
  FINANCES: "Infractions financières",
  PERSONNES: "Atteintes aux personnes",
  EXPRESSION: "Infractions d'expression",
  AUTRE: "Autres infractions",
};

export const AFFAIR_SUPER_CATEGORY_DESCRIPTIONS: Record<AffairSuperCategory, string> = {
  PROBITE: "Corruption, détournement de fonds, emplois fictifs, prise illégale d'intérêts",
  FINANCES: "Fraude fiscale, blanchiment, abus de biens sociaux",
  PERSONNES: "Harcèlement, agressions, violences",
  EXPRESSION: "Diffamation, injure, incitation à la haine",
  AUTRE: "Autres types d'infractions",
};

export const AFFAIR_SUPER_CATEGORY_COLORS: Record<AffairSuperCategory, string> = {
  PROBITE: "bg-purple-100 text-purple-800 border-purple-300",
  FINANCES: "bg-blue-100 text-blue-800 border-blue-300",
  PERSONNES: "bg-red-100 text-red-800 border-red-300",
  EXPRESSION: "bg-amber-100 text-amber-800 border-amber-300",
  AUTRE: "bg-gray-100 text-gray-800 border-gray-300",
};

// Map categories to super-categories
export const CATEGORY_TO_SUPER: Record<AffairCategory, AffairSuperCategory> = {
  CORRUPTION: "PROBITE",
  CORRUPTION_PASSIVE: "PROBITE",
  TRAFIC_INFLUENCE: "PROBITE",
  PRISE_ILLEGALE_INTERETS: "PROBITE",
  FAVORITISME: "PROBITE",
  DETOURNEMENT_FONDS_PUBLICS: "PROBITE",
  EMPLOI_FICTIF: "PROBITE",
  CONFLIT_INTERETS: "PROBITE",
  FINANCEMENT_ILLEGAL_CAMPAGNE: "FINANCES",
  FINANCEMENT_ILLEGAL_PARTI: "FINANCES",
  FRAUDE_FISCALE: "FINANCES",
  BLANCHIMENT: "FINANCES",
  ABUS_BIENS_SOCIAUX: "FINANCES",
  ABUS_CONFIANCE: "FINANCES",
  RECEL: "FINANCES",
  HARCELEMENT_MORAL: "PERSONNES",
  HARCELEMENT_SEXUEL: "PERSONNES",
  AGRESSION_SEXUELLE: "PERSONNES",
  VIOLENCE: "PERSONNES",
  MENACE: "PERSONNES",
  DIFFAMATION: "EXPRESSION",
  INJURE: "EXPRESSION",
  INCITATION_HAINE: "EXPRESSION",
  FAUX_ET_USAGE_FAUX: "AUTRE",
  AUTRE: "AUTRE",
};

// Get categories for a super-category
export function getCategoriesForSuper(superCat: AffairSuperCategory): AffairCategory[] {
  return Object.entries(CATEGORY_TO_SUPER)
    .filter(([, sc]) => sc === superCat)
    .map(([cat]) => cat as AffairCategory);
}

export const MANDATE_TYPE_LABELS: Record<MandateType, string> = {
  DEPUTE: "Député",
  SENATEUR: "Sénateur",
  DEPUTE_EUROPEEN: "Député européen",
  PRESIDENT_REPUBLIQUE: "Président de la République",
  PREMIER_MINISTRE: "Premier ministre",
  MINISTRE: "Ministre",
  SECRETAIRE_ETAT: "Secrétaire d'État",
  MINISTRE_DELEGUE: "Ministre délégué",
  PRESIDENT_REGION: "Président de région",
  PRESIDENT_DEPARTEMENT: "Président de département",
  MAIRE: "Maire",
  ADJOINT_MAIRE: "Adjoint au maire",
  CONSEILLER_REGIONAL: "Conseiller régional",
  CONSEILLER_DEPARTEMENTAL: "Conseiller départemental",
  CONSEILLER_MUNICIPAL: "Conseiller municipal",
  PRESIDENT_PARTI: "Président(e) de parti",
  OTHER: "Autre mandat",
};

// Feminize institutional roles based on civility
export function feminizeRole(role: string, civility?: string | null): string {
  if (civility !== "Mme") return role;
  return role.replace(/^Président /, "Présidente ").replace(/^Vice-président /, "Vice-présidente ");
}

// Salary information (public data, monthly gross in EUR)
export const MANDATE_SALARIES: Partial<Record<MandateType, number>> = {
  DEPUTE: 7493, // Indemnité parlementaire brute
  SENATEUR: 7493,
  DEPUTE_EUROPEEN: 9808,
  PRESIDENT_REPUBLIQUE: 15900,
  PREMIER_MINISTRE: 15900,
  MINISTRE: 10647,
  SECRETAIRE_ETAT: 10135,
  MINISTRE_DELEGUE: 10135,
};

// Data source labels
export const DATA_SOURCE_LABELS: Record<DataSource, string> = {
  ASSEMBLEE_NATIONALE: "Assemblée nationale",
  SENAT: "Sénat",
  PARLEMENT_EUROPEEN: "Parlement européen",
  WIKIDATA: "Wikidata",
  HATVP: "HATVP",
  GOUVERNEMENT: "Gouvernement",
  NOSDEPUTES: "NosDéputés.fr",
  WIKIPEDIA: "Wikipédia",
  MANUAL: "Saisie manuelle",
};

export const DATA_SOURCE_URLS: Record<DataSource, string> = {
  ASSEMBLEE_NATIONALE: "https://www.assemblee-nationale.fr/dyn/deputes/",
  SENAT: "https://www.senat.fr/senateur/",
  PARLEMENT_EUROPEEN: "https://www.europarl.europa.eu/meps/fr/",
  WIKIDATA: "https://www.wikidata.org/wiki/",
  HATVP: "https://www.hatvp.fr/",
  GOUVERNEMENT: "https://www.gouvernement.fr/",
  NOSDEPUTES: "https://www.nosdeputes.fr/",
  WIKIPEDIA: "https://fr.wikipedia.org/wiki/",
  MANUAL: "",
};

// Political position labels (for parties)
export const POLITICAL_POSITION_LABELS: Record<PoliticalPosition, string> = {
  FAR_LEFT: "Extrême gauche",
  LEFT: "Gauche",
  CENTER_LEFT: "Centre gauche",
  CENTER: "Centre",
  CENTER_RIGHT: "Centre droit",
  RIGHT: "Droite",
  FAR_RIGHT: "Extrême droite",
};

export const POLITICAL_POSITION_COLORS: Record<PoliticalPosition, string> = {
  FAR_LEFT: "#8B0000", // Dark red
  LEFT: "#FF6B6B", // Light red
  CENTER_LEFT: "#FFB6C1", // Pink
  CENTER: "#FFEB3B", // Yellow
  CENTER_RIGHT: "#87CEEB", // Light blue
  RIGHT: "#1E90FF", // Blue
  FAR_RIGHT: "#00008B", // Dark blue
};

// Order for display (left to right)
export const POLITICAL_POSITION_ORDER: PoliticalPosition[] = [
  "FAR_LEFT",
  "LEFT",
  "CENTER_LEFT",
  "CENTER",
  "CENTER_RIGHT",
  "RIGHT",
  "FAR_RIGHT",
];

// Affair event type labels (chronology)
export const AFFAIR_EVENT_TYPE_LABELS: Record<AffairEventType, string> = {
  FAITS: "Faits",
  REVELATION: "Révélation médiatique",
  PLAINTE: "Dépôt de plainte",
  ENQUETE_PRELIMINAIRE: "Enquête préliminaire",
  INFORMATION_JUDICIAIRE: "Information judiciaire",
  PERQUISITION: "Perquisition",
  GARDE_A_VUE: "Garde à vue",
  MISE_EN_EXAMEN: "Mise en examen",
  CONTROLE_JUDICIAIRE: "Contrôle judiciaire",
  DETENTION_PROVISOIRE: "Détention provisoire",
  RENVOI_TRIBUNAL: "Renvoi devant le tribunal",
  PROCES: "Procès",
  REQUISITOIRE: "Réquisitoire",
  JUGEMENT: "Jugement",
  APPEL: "Appel interjeté",
  PROCES_APPEL: "Procès en appel",
  ARRET_APPEL: "Arrêt de la cour d'appel",
  POURVOI_CASSATION: "Pourvoi en cassation",
  ARRET_CASSATION: "Arrêt de la Cour de cassation",
  RELAXE: "Relaxe",
  ACQUITTEMENT: "Acquittement",
  CONDAMNATION: "Condamnation",
  PRESCRIPTION: "Prescription",
  NON_LIEU: "Non-lieu",
  AUTRE: "Autre événement",
};

// Event type colors for timeline display
export const AFFAIR_EVENT_TYPE_COLORS: Record<AffairEventType, string> = {
  FAITS: "bg-gray-500",
  REVELATION: "bg-yellow-500",
  PLAINTE: "bg-orange-400",
  ENQUETE_PRELIMINAIRE: "bg-orange-500",
  INFORMATION_JUDICIAIRE: "bg-orange-600",
  PERQUISITION: "bg-amber-500",
  GARDE_A_VUE: "bg-amber-600",
  MISE_EN_EXAMEN: "bg-red-400",
  CONTROLE_JUDICIAIRE: "bg-red-500",
  DETENTION_PROVISOIRE: "bg-red-600",
  RENVOI_TRIBUNAL: "bg-purple-500",
  PROCES: "bg-purple-600",
  REQUISITOIRE: "bg-purple-700",
  JUGEMENT: "bg-indigo-500",
  APPEL: "bg-blue-400",
  PROCES_APPEL: "bg-blue-500",
  ARRET_APPEL: "bg-blue-600",
  POURVOI_CASSATION: "bg-sky-500",
  ARRET_CASSATION: "bg-sky-600",
  RELAXE: "bg-green-500",
  ACQUITTEMENT: "bg-green-600",
  CONDAMNATION: "bg-red-700",
  PRESCRIPTION: "bg-gray-400",
  NON_LIEU: "bg-gray-500",
  AUTRE: "bg-gray-600",
};

// ============================================
// PARLIAMENTARY VOTES
// ============================================

export const VOTE_POSITION_LABELS: Record<VotePosition, string> = {
  POUR: "Pour",
  CONTRE: "Contre",
  ABSTENTION: "Abstention",
  NON_VOTANT: "Non-votant",
  ABSENT: "Absent",
};

export const VOTE_POSITION_COLORS: Record<VotePosition, string> = {
  POUR: "bg-green-100 text-green-800 border-green-300",
  CONTRE: "bg-red-100 text-red-800 border-red-300",
  ABSTENTION: "bg-yellow-100 text-yellow-800 border-yellow-300",
  NON_VOTANT: "bg-slate-100 text-slate-700 border-slate-300",
  ABSENT: "bg-gray-100 text-gray-700 border-gray-300",
};

export const VOTE_POSITION_DOT_COLORS: Record<VotePosition, string> = {
  POUR: "bg-green-500",
  CONTRE: "bg-red-500",
  ABSTENTION: "bg-yellow-500",
  NON_VOTANT: "bg-gray-500",
  ABSENT: "bg-gray-400",
};

export const VOTING_RESULT_LABELS: Record<VotingResult, string> = {
  ADOPTED: "Adopté",
  REJECTED: "Rejeté",
};

export const VOTING_RESULT_COLORS: Record<VotingResult, string> = {
  ADOPTED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

// ============================================
// CHAMBER (Assemblée / Sénat)
// ============================================

export const CHAMBER_LABELS: Record<Chamber, string> = {
  AN: "Assemblée nationale",
  SENAT: "Sénat",
};

export const CHAMBER_SHORT_LABELS: Record<Chamber, string> = {
  AN: "AN",
  SENAT: "Sénat",
};

export const CHAMBER_COLORS: Record<Chamber, string> = {
  AN: "bg-blue-100 text-blue-800 border-blue-300",
  SENAT: "bg-rose-100 text-rose-800 border-rose-300",
};

// ============================================
// LEGISLATIVE DOSSIERS
// ============================================

import type { DossierStatus, AmendmentStatus } from "@/generated/prisma";

export const DOSSIER_STATUS_LABELS: Record<DossierStatus, string> = {
  EN_COURS: "En discussion",
  ADOPTE: "Adopté",
  REJETE: "Rejeté",
  RETIRE: "Retiré",
};

export const DOSSIER_STATUS_COLORS: Record<DossierStatus, string> = {
  EN_COURS: "bg-blue-100 text-blue-800 border-blue-300",
  ADOPTE: "bg-green-100 text-green-800 border-green-300",
  REJETE: "bg-red-100 text-red-800 border-red-300",
  RETIRE: "bg-gray-100 text-gray-700 border-gray-300",
};

export const DOSSIER_STATUS_ICONS: Record<DossierStatus, string> = {
  EN_COURS: "🔴",
  ADOPTE: "✅",
  REJETE: "❌",
  RETIRE: "⏸️",
};

export const AMENDMENT_STATUS_LABELS: Record<AmendmentStatus, string> = {
  DEPOSE: "Déposé",
  ADOPTE: "Adopté",
  REJETE: "Rejeté",
  RETIRE: "Retiré",
  TOMBE: "Tombé",
};

export const AMENDMENT_STATUS_COLORS: Record<AmendmentStatus, string> = {
  DEPOSE: "bg-blue-100 text-blue-800",
  ADOPTE: "bg-green-100 text-green-800",
  REJETE: "bg-red-100 text-red-800",
  RETIRE: "bg-gray-100 text-gray-700",
  TOMBE: "bg-gray-100 text-gray-600",
};

// Legislative categories with colors
export const DOSSIER_CATEGORY_COLORS: Record<string, string> = {
  Budget: "bg-emerald-100 text-emerald-800 border-emerald-300",
  Santé: "bg-rose-100 text-rose-800 border-rose-300",
  Économie: "bg-amber-100 text-amber-800 border-amber-300",
  Législation: "bg-indigo-100 text-indigo-800 border-indigo-300",
  Institutionnel: "bg-purple-100 text-purple-800 border-purple-300",
  Constitution: "bg-violet-100 text-violet-800 border-violet-300",
  International: "bg-cyan-100 text-cyan-800 border-cyan-300",
  Contrôle: "bg-orange-100 text-orange-800 border-orange-300",
  Information: "bg-sky-100 text-sky-800 border-sky-300",
};

export const DOSSIER_CATEGORY_ICONS: Record<string, string> = {
  Budget: "💰",
  Santé: "🏥",
  Économie: "📊",
  Législation: "📜",
  Institutionnel: "🏛️",
  Constitution: "⚖️",
  International: "🌍",
  Contrôle: "🔍",
  Information: "📋",
};

// ============================================
// THEME CATEGORIES (legislative dossiers & scrutins)
// ============================================

export const THEME_CATEGORY_LABELS: Record<ThemeCategory, string> = {
  ECONOMIE_BUDGET: "Économie & Budget",
  SOCIAL_TRAVAIL: "Social & Travail",
  SECURITE_JUSTICE: "Sécurité & Justice",
  ENVIRONNEMENT_ENERGIE: "Environnement & Énergie",
  SANTE: "Santé",
  EDUCATION_CULTURE: "Éducation & Culture",
  INSTITUTIONS: "Institutions",
  AFFAIRES_ETRANGERES_DEFENSE: "Affaires étrangères & Défense",
  NUMERIQUE_TECH: "Numérique & Tech",
  IMMIGRATION: "Immigration",
  AGRICULTURE_ALIMENTATION: "Agriculture & Alimentation",
  LOGEMENT_URBANISME: "Logement & Urbanisme",
  TRANSPORTS: "Transports",
};

export const THEME_CATEGORY_COLORS: Record<ThemeCategory, string> = {
  ECONOMIE_BUDGET: "bg-emerald-100 text-emerald-800 border-emerald-300",
  SOCIAL_TRAVAIL: "bg-violet-100 text-violet-800 border-violet-300",
  SECURITE_JUSTICE: "bg-red-100 text-red-800 border-red-300",
  ENVIRONNEMENT_ENERGIE: "bg-green-100 text-green-800 border-green-300",
  SANTE: "bg-rose-100 text-rose-800 border-rose-300",
  EDUCATION_CULTURE: "bg-indigo-100 text-indigo-800 border-indigo-300",
  INSTITUTIONS: "bg-purple-100 text-purple-800 border-purple-300",
  AFFAIRES_ETRANGERES_DEFENSE: "bg-cyan-100 text-cyan-800 border-cyan-300",
  NUMERIQUE_TECH: "bg-sky-100 text-sky-800 border-sky-300",
  IMMIGRATION: "bg-orange-100 text-orange-800 border-orange-300",
  AGRICULTURE_ALIMENTATION: "bg-lime-100 text-lime-800 border-lime-300",
  LOGEMENT_URBANISME: "bg-amber-100 text-amber-800 border-amber-300",
  TRANSPORTS: "bg-teal-100 text-teal-800 border-teal-300",
};

export const THEME_CATEGORY_ICONS: Record<ThemeCategory, string> = {
  ECONOMIE_BUDGET: "💰",
  SOCIAL_TRAVAIL: "👥",
  SECURITE_JUSTICE: "🔒",
  ENVIRONNEMENT_ENERGIE: "🌿",
  SANTE: "🏥",
  EDUCATION_CULTURE: "📚",
  INSTITUTIONS: "🏛️",
  AFFAIRES_ETRANGERES_DEFENSE: "🌍",
  NUMERIQUE_TECH: "💻",
  IMMIGRATION: "🛂",
  AGRICULTURE_ALIMENTATION: "🌾",
  LOGEMENT_URBANISME: "🏠",
  TRANSPORTS: "🚆",
};

// ============================================
// PARTY ROLES
// ============================================

export const PARTY_ROLE_LABELS: Record<PartyRole, string> = {
  MEMBER: "Membre",
  FOUNDER: "Fondateur",
  SPOKESPERSON: "Porte-parole",
  COORDINATOR: "Coordinateur",
  HONORARY_PRESIDENT: "Président d'honneur",
  SECRETARY_GENERAL: "Secrétaire général",
};

export const SIGNIFICANT_PARTY_ROLES: PartyRole[] = [
  "FOUNDER",
  "SPOKESPERSON",
  "COORDINATOR",
  "HONORARY_PRESIDENT",
  "SECRETARY_GENERAL",
];

export function feminizePartyRole(label: string, civility?: string | null): string {
  if (civility !== "Mme") return label;
  return label
    .replace("Fondateur", "Fondatrice")
    .replace("Coordinateur", "Coordinatrice")
    .replace("Président d'honneur", "Présidente d'honneur")
    .replace("Secrétaire général", "Secrétaire générale");
}

// ============================================
// FACT-CHECKS
// ============================================

export const FACTCHECK_RATING_LABELS: Record<FactCheckRating, string> = {
  TRUE: "Vrai",
  MOSTLY_TRUE: "Plutôt vrai",
  HALF_TRUE: "Partiellement vrai",
  MISLEADING: "Trompeur",
  OUT_OF_CONTEXT: "Hors contexte",
  MOSTLY_FALSE: "Plutôt faux",
  FALSE: "Faux",
  UNVERIFIABLE: "Invérifiable",
};

export const FACTCHECK_RATING_COLORS: Record<FactCheckRating, string> = {
  TRUE: "bg-green-100 text-green-800",
  MOSTLY_TRUE: "bg-green-50 text-green-700",
  HALF_TRUE: "bg-yellow-100 text-yellow-800",
  MISLEADING: "bg-orange-100 text-orange-800",
  OUT_OF_CONTEXT: "bg-amber-100 text-amber-800",
  MOSTLY_FALSE: "bg-red-50 text-red-700",
  FALSE: "bg-red-100 text-red-800",
  UNVERIFIABLE: "bg-gray-100 text-gray-800",
};

export const FACTCHECK_RATING_DESCRIPTIONS: Record<FactCheckRating, string> = {
  TRUE: "L'affirmation est exacte et vérifiable par des sources fiables.",
  MOSTLY_TRUE: "L'affirmation est globalement exacte, avec des nuances mineures.",
  HALF_TRUE: "L'affirmation contient une part de vérité mais omet des éléments importants.",
  MISLEADING: "L'affirmation utilise des faits réels de manière trompeuse.",
  OUT_OF_CONTEXT: "L'affirmation sort des éléments de leur contexte d'origine.",
  MOSTLY_FALSE: "L'affirmation est en grande partie inexacte.",
  FALSE: "L'affirmation est contraire aux faits établis.",
  UNVERIFIABLE: "L'affirmation ne peut être vérifiée par les sources disponibles.",
};

/**
 * Detect if a fact-check claimant is a specific person (politician)
 * vs a generic source (social media, multiple sources, etc.)
 */
const GENERIC_CLAIMANT_PATTERNS = [
  "réseaux sociaux",
  "sources multiples",
  "sites internet",
  "publications",
  "utilisateurs",
  "internautes",
  "viral",
  "facebook",
  "twitter",
  "tiktok",
  "whatsapp",
  "telegram",
  "youtube",
  "instagram",
  "chaîne de mails",
  "rumeur",
  "blog",
  "forum",
];

export function isDirectPoliticianClaim(claimant: string | null): boolean {
  if (!claimant) return false;
  const lower = claimant.toLowerCase();
  return !GENERIC_CLAIMANT_PATTERNS.some((pattern) => lower.includes(pattern));
}
