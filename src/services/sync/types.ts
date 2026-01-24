// Types for external data sources

// data.gouv.fr CSV structure (Datan dataset)
export interface DeputeCSV {
  id: string; // PA1008
  legislature: string;
  civ: string; // M. / Mme
  nom: string;
  prenom: string;
  villeNaissance: string;
  naissance: string; // YYYY-MM-DD
  age: string;
  groupe: string; // Full group name
  groupeAbrev: string; // SOC, RN, LFI, etc.
  departementNom: string;
  departementCode: string;
  circo: string; // Circonscription number
  datePriseFonction: string;
  job: string; // Profession
  mail: string;
  twitter: string;
  facebook: string;
  website: string;
  nombreMandats: string;
  experienceDepute: string;
  scoreParticipation: string;
  scoreParticipationSpecialite: string;
  scoreLoyaute: string;
  scoreMajorite: string;
  dateMaj: string;
}

// Mapped party data
export interface PartyMapping {
  shortName: string;
  fullName: string;
  color: string;
}

// Known French political parties (17e legislature - 2024-2027)
// Maps CSV groupeAbrev -> display shortName, fullName, color
export const PARTY_MAPPINGS: Record<string, PartyMapping> = {
  // Groupes parlementaires actuels (jan 2026)
  RN: { shortName: "RN", fullName: "Rassemblement National", color: "#0D378A" },
  "LFI-NFP": { shortName: "LFI", fullName: "La France Insoumise - Nouveau Front Populaire", color: "#CC2443" },
  SOC: { shortName: "SOC", fullName: "Socialistes et apparentés", color: "#FF8080" },
  EPR: { shortName: "EPR", fullName: "Ensemble pour la République", color: "#FFEB00" },
  DR: { shortName: "DR", fullName: "Droite Républicaine", color: "#0066CC" },
  DEM: { shortName: "DEM", fullName: "Les Démocrates", color: "#FF9900" },
  HOR: { shortName: "HOR", fullName: "Horizons & Indépendants", color: "#0001AA" },
  LIOT: { shortName: "LIOT", fullName: "Libertés, Indépendants, Outre-mer et Territoires", color: "#AADDFF" },
  ECOS: { shortName: "ECOS", fullName: "Écologiste et Social", color: "#00C000" },
  GDR: { shortName: "GDR", fullName: "Gauche Démocrate et Républicaine", color: "#DD0000" },
  UDDPLR: { shortName: "UDR", fullName: "Union des Droites pour la République", color: "#8040C0" },
  NI: { shortName: "NI", fullName: "Non-inscrits", color: "#AAAAAA" },
};

export interface SyncResult {
  success: boolean;
  partiesCreated: number;
  partiesUpdated: number;
  deputiesCreated: number;
  deputiesUpdated: number;
  errors: string[];
}

// ============================================
// SENAT API TYPES
// ============================================

// From senat.fr/api-senat/senateurs.json
export interface SenateurAPI {
  matricule: string;
  nom: string;
  prenom: string;
  civilite: string; // "M." or "Mme"
  feminise: boolean;
  tri: string;
  serie: number; // 1 or 2
  siege: number;
  url: string;
  urlAvatar: string;
  twitter?: string;
  facebook?: string;
  groupe: {
    code: string;
    libelle: string;
    ordre: number;
  };
  circonscription: {
    code: string;
    libelle: string;
    ordre: number;
  };
  categorieProfessionnelle?: {
    code: string;
    libelle: string;
  };
}

// From archive.nossenateurs.fr/senateurs/json (for birth dates)
export interface NosSenateursAPI {
  id: string;
  nom: string;
  nom_de_famille: string;
  prenom: string;
  sexe: string;
  date_naissance?: string;
  lieu_naissance?: string;
  num_deptmt?: string;
  nom_circo?: string;
  groupe_sigle?: string;
  parti_ratt_financier?: string;
  mandat_debut?: string;
  mandat_fin?: string;
  ancien_senateur?: number;
  nb_mandats?: number;
  profession?: string;
  place_en_hemicycle?: string;
  url_institution?: string;
  id_institution?: string;
  slug?: string;
}

export interface SenatSyncResult {
  success: boolean;
  partiesCreated: number;
  partiesUpdated: number;
  senatorsCreated: number;
  senatorsUpdated: number;
  errors: string[];
}

// ============================================
// GOVERNMENT API TYPES
// ============================================

// From data.gouv.fr - Historique des Gouvernements
export interface GouvernementCSV {
  id: string;              // Government ID (e.g., "546")
  gouvernement: string;    // Government name (PM name)
  code_fonction: string;   // PM, ME, M, MD, SE
  prenom: string;
  nom: string;
  fonction: string;        // Full function title
  date_debut_fonction: string;  // French date: "vendredi 13 décembre 2024"
  date_fin_fonction: string;    // Empty if current
}

export interface GouvernementSyncResult {
  success: boolean;
  membersCreated: number;
  membersUpdated: number;
  mandatesCreated: number;
  errors: string[];
}

// ============================================
// HATVP API TYPES
// ============================================

// From hatvp.fr/livraison/opendata/liste.csv
export interface HATVPCSV {
  civilite: string;           // M. / Mme
  prenom: string;
  nom: string;                // NOM (uppercase)
  classement: string;         // Internal sort key
  type_mandat: string;        // depute, senateur, gouvernement, commune, etc.
  qualite: string;            // Full mandate description
  type_document: string;      // di, dim, dia, diam, dsp, dspm, dspfm
  departement: string;        // Department code
  date_publication: string;   // YYYY-MM-DD
  date_depot: string;         // YYYY-MM-DD
  nom_fichier: string;        // PDF filename
  url_dossier: string;        // Relative URL to personal page
  open_data: string;          // XML filename if available
  statut_publication: string; // Livree, Declaration deposee, etc.
  id_origine: string;         // External ID (AN or Senat ID)
  url_photo: string;          // Official photo URL
}

export interface HATVPSyncResult {
  success: boolean;
  declarationsCreated: number;
  declarationsUpdated: number;
  politiciansMatched: number;
  politiciansNotFound: number;
  errors: string[];
}

// HATVP document type to DeclarationType mapping
export const HATVP_DOCUMENT_TYPE_MAPPING: Record<string, string> = {
  "di": "INTERETS",
  "dim": "INTERETS",
  "dia": "INTERETS",
  "diam": "INTERETS",
  "dsp": "PATRIMOINE_DEBUT_MANDAT",
  "dspm": "PATRIMOINE_MODIFICATION",
  "dspfm": "PATRIMOINE_FIN_MANDAT",
};

// Government function code to MandateType mapping
export const GOUV_FUNCTION_MAPPING: Record<string, string> = {
  "PM": "PREMIER_MINISTRE",
  "PE": "PREMIER_MINISTRE",  // Sometimes written as PE
  "ME": "MINISTRE",          // Ministre d'État is still a minister
  "M": "MINISTRE",
  "MD": "MINISTRE_DELEGUE",
  "SE": "SECRETAIRE_ETAT",
};

// Senate group mappings (similar to PARTY_MAPPINGS for deputies)
export const SENATE_GROUP_MAPPINGS: Record<string, PartyMapping> = {
  // Groupes sénatoriaux (jan 2026)
  "RDPI": { shortName: "RDPI", fullName: "Rassemblement des démocrates progressistes et indépendants", color: "#FFEB00" },
  "LR": { shortName: "LR", fullName: "Les Républicains", color: "#0066CC" },
  "SER": { shortName: "SER", fullName: "Socialiste, Écologiste et Républicain", color: "#FF8080" },
  "UC": { shortName: "UC", fullName: "Union Centriste", color: "#FF9900" },
  "CRCE-K": { shortName: "CRCE", fullName: "Communiste, Républicain, Citoyen et Écologiste - Kanaky", color: "#DD0000" },
  "CRCE": { shortName: "CRCE", fullName: "Communiste, Républicain, Citoyen et Écologiste", color: "#DD0000" },
  "GEST": { shortName: "GEST", fullName: "Écologiste - Solidarité et Territoires", color: "#00C000" },
  "RDSE": { shortName: "RDSE", fullName: "Rassemblement Démocratique et Social Européen", color: "#F0A000" },
  "INDEP": { shortName: "INDEP", fullName: "Les Indépendants - République et Territoires", color: "#00AAAA" },
  "RASNAG": { shortName: "RN", fullName: "Rassemblement National", color: "#0D378A" },
  "RN": { shortName: "RN", fullName: "Rassemblement National", color: "#0D378A" },
  "NI": { shortName: "NI", fullName: "Non-inscrits", color: "#AAAAAA" },
  "SENRI": { shortName: "NI", fullName: "Sénateurs ne figurant sur la liste d'aucun groupe", color: "#AAAAAA" },
}
