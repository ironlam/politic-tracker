/**
 * Party and European Group configuration
 *
 * This file contains local customizations for parties and European groups.
 * Wikidata provides factual data (dates, ideologies, etc.), while this file
 * handles display preferences (colors, short names, etc.)
 */

export interface PartyConfig {
  shortName: string;
  fullName: string;
  color: string;
  wikidataId?: string;
}

export interface EuropeanGroupConfig {
  code: string;
  name: string;
  shortName?: string;
  color: string;
  politicalPosition?:
    | "FAR_LEFT"
    | "LEFT"
    | "CENTER_LEFT"
    | "CENTER"
    | "CENTER_RIGHT"
    | "RIGHT"
    | "FAR_RIGHT";
  wikidataId?: string;
  website?: string;
}

// ============================================
// FRENCH PARTIES - Assembly Groups
// ============================================

export const FRENCH_ASSEMBLY_PARTIES: Record<string, PartyConfig> = {
  // 17th legislature (2024-2027)
  RN: {
    shortName: "RN",
    fullName: "Rassemblement National",
    color: "#0D378A",
    wikidataId: "Q485840",
  },
  "LFI-NFP": {
    shortName: "LFI",
    fullName: "La France Insoumise - Nouveau Front Populaire",
    color: "#CC2443",
    wikidataId: "Q20905918",
  },
  SOC: {
    shortName: "SOC",
    fullName: "Socialistes et apparentés",
    color: "#FF8080",
    wikidataId: "Q151614",
  },
  EPR: {
    shortName: "EPR",
    fullName: "Ensemble pour la République",
    color: "#FFEB00",
    wikidataId: "Q110797741",
  },
  DR: { shortName: "DR", fullName: "Droite Républicaine", color: "#0066CC", wikidataId: "Q829126" },
  DEM: { shortName: "DEM", fullName: "Les Démocrates", color: "#FF9900", wikidataId: "Q3277601" },
  HOR: {
    shortName: "HOR",
    fullName: "Horizons & Indépendants",
    color: "#0001AA",
    wikidataId: "Q108055027",
  },
  LIOT: {
    shortName: "LIOT",
    fullName: "Libertés, Indépendants, Outre-mer et Territoires",
    color: "#AADDFF",
  },
  ECOS: {
    shortName: "ECOS",
    fullName: "Écologiste et Social",
    color: "#00C000",
    wikidataId: "Q211595",
  },
  GDR: {
    shortName: "GDR",
    fullName: "Gauche Démocrate et Républicaine",
    color: "#DD0000",
    wikidataId: "Q121596",
  },
  UDR: { shortName: "UDR", fullName: "Union des Droites pour la République", color: "#8040C0" },
  NI: { shortName: "NI", fullName: "Non-inscrits", color: "#AAAAAA" },
  // Parti hors groupe parlementaire (eurodéputés)
  IDL: {
    shortName: "IDL",
    fullName: "Identité-Libertés",
    color: "#1C2951",
    wikidataId: "Q130517388",
  },
};

// ============================================
// FRENCH PARTIES - Senate Groups
// ============================================

export const FRENCH_SENATE_PARTIES: Record<string, PartyConfig> = {
  RDPI: {
    shortName: "RDPI",
    fullName: "Rassemblement des démocrates progressistes et indépendants",
    color: "#FFEB00",
  },
  LR: { shortName: "LR", fullName: "Les Républicains", color: "#0066CC", wikidataId: "Q829126" },
  SER: { shortName: "SER", fullName: "Socialiste, Écologiste et Républicain", color: "#FF8080" },
  UC: { shortName: "UC", fullName: "Union Centriste", color: "#FF9900" },
  "CRCE-K": {
    shortName: "CRCE",
    fullName: "Communiste, Républicain, Citoyen et Écologiste - Kanaky",
    color: "#DD0000",
  },
  CRCE: {
    shortName: "CRCE",
    fullName: "Communiste, Républicain, Citoyen et Écologiste",
    color: "#DD0000",
  },
  GEST: { shortName: "GEST", fullName: "Écologiste - Solidarité et Territoires", color: "#00C000" },
  RDSE: {
    shortName: "RDSE",
    fullName: "Rassemblement Démocratique et Social Européen",
    color: "#F0A000",
  },
  INDEP: {
    shortName: "INDEP",
    fullName: "Les Indépendants - République et Territoires",
    color: "#00AAAA",
  },
  RASNAG: {
    shortName: "RN",
    fullName: "Rassemblement National",
    color: "#0D378A",
    wikidataId: "Q485840",
  },
  RN: {
    shortName: "RN",
    fullName: "Rassemblement National",
    color: "#0D378A",
    wikidataId: "Q485840",
  },
  NI: { shortName: "NI", fullName: "Non-inscrits", color: "#AAAAAA" },
  SENRI: {
    shortName: "NI",
    fullName: "Sénateurs ne figurant sur la liste d'aucun groupe",
    color: "#AAAAAA",
  },
};

// ============================================
// EUROPEAN PARLIAMENT GROUPS - 10th Legislature (2024-2029)
// ============================================

export const EUROPEAN_GROUPS: EuropeanGroupConfig[] = [
  {
    code: "PPE",
    name: "Parti populaire européen",
    color: "#3399FF",
    politicalPosition: "CENTER_RIGHT",
    wikidataId: "Q835624",
    website: "https://www.eppgroup.eu",
  },
  {
    code: "S&D",
    name: "Alliance Progressiste des Socialistes et Démocrates",
    shortName: "S&D",
    color: "#F0001C",
    politicalPosition: "CENTER_LEFT",
    wikidataId: "Q384697",
    website: "https://www.socialistsanddemocrats.eu",
  },
  {
    code: "Renew",
    name: "Renew Europe",
    color: "#FFD700",
    politicalPosition: "CENTER",
    wikidataId: "Q64803279",
    website: "https://www.reneweurope.eu",
  },
  {
    code: "Verts/ALE",
    name: "Verts/Alliance libre européenne",
    shortName: "Verts/ALE",
    color: "#009900",
    politicalPosition: "LEFT",
    wikidataId: "Q741681",
    website: "https://www.greens-efa.eu",
  },
  {
    code: "PfE",
    name: "Patriots for Europe",
    shortName: "PfE",
    color: "#1E3A5F",
    politicalPosition: "RIGHT",
    wikidataId: "Q126880025",
  },
  {
    code: "ECR",
    name: "Conservateurs et Réformistes européens",
    shortName: "ECR",
    color: "#0054A5",
    politicalPosition: "RIGHT",
    wikidataId: "Q756355",
    website: "https://ecrgroup.eu",
  },
  {
    code: "The Left",
    name: "La Gauche au Parlement européen",
    shortName: "GUE/NGL",
    color: "#990000",
    politicalPosition: "FAR_LEFT",
    wikidataId: "Q842438",
    website: "https://left.eu",
  },
  {
    code: "ESN",
    name: "Europe of Sovereign Nations",
    shortName: "ESN",
    color: "#4A4A4A",
    politicalPosition: "FAR_RIGHT",
    wikidataId: "Q127389816",
  },
  {
    code: "NI",
    name: "Non-inscrits",
    color: "#999999",
  },
];

// Helper to get European group config by code
export function getEuropeanGroupConfig(code: string): EuropeanGroupConfig | undefined {
  return EUROPEAN_GROUPS.find((g) => g.code === code);
}

// Helper to get party config by abbreviation
export function getPartyConfig(abbrev: string): PartyConfig | undefined {
  return FRENCH_ASSEMBLY_PARTIES[abbrev] || FRENCH_SENATE_PARTIES[abbrev];
}
