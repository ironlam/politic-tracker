import type { AffairStatus, AffairCategory, MandateType } from "@/types";

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
