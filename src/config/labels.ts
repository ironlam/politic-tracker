import type { AffairStatus, AffairCategory, MandateType, DataSource, PoliticalPosition, AffairEventType } from "@/types";

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
  OTHER: "Autre mandat",
};

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
  FAR_LEFT: "#8B0000",    // Dark red
  LEFT: "#FF6B6B",        // Light red
  CENTER_LEFT: "#FFB6C1", // Pink
  CENTER: "#FFEB3B",      // Yellow
  CENTER_RIGHT: "#87CEEB",// Light blue
  RIGHT: "#1E90FF",       // Blue
  FAR_RIGHT: "#00008B",   // Dark blue
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
