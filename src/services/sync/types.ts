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
