/**
 * Parliamentary Groups Configuration
 *
 * Maps parliamentary group codes (from AN CSV / Sénat API) to their
 * corresponding real political parties via Wikidata Q-IDs.
 *
 * Parliamentary groups ≠ political parties:
 * - Groups are formations within a chamber (AN/Sénat)
 * - A group can contain members from multiple parties
 * - A party can have members across different groups
 *
 * When a group maps to a single dominant party, we set partyWikidataId.
 * When a group is transpartisan or mixed, partyWikidataId is null.
 */

import type { PoliticalPosition } from "@/generated/prisma";
import { WD_PARTIES } from "./wikidata";

export interface ParliamentaryGroupConfig {
  /** Group code as used in source data (CSV groupeAbrev / API groupe.code) */
  code: string;
  /** Full official name of the group */
  name: string;
  /** Short display name (if different from code) */
  shortName?: string;
  /** Hex color for UI */
  color: string;
  /** Political positioning */
  politicalPosition?: PoliticalPosition;
  /** Wikidata Q-ID of the parliamentary group itself */
  wikidataId?: string;
  /** Wikidata Q-ID of the corresponding real political party (null if transpartisan) */
  partyWikidataId?: string;
}

// ============================================
// ASSEMBLÉE NATIONALE - 17e législature (2024-2027)
// ============================================

export const ASSEMBLY_GROUPS: Record<string, ParliamentaryGroupConfig> = {
  RN: {
    code: "RN",
    name: "Rassemblement National",
    color: "#0D378A",
    politicalPosition: "FAR_RIGHT",
    wikidataId: WD_PARTIES.GROUPE_RN_AN,
    partyWikidataId: WD_PARTIES.RN,
  },
  "LFI-NFP": {
    code: "LFI-NFP",
    name: "La France Insoumise - Nouveau Front Populaire",
    shortName: "LFI-NFP",
    color: "#CC2443",
    politicalPosition: "FAR_LEFT",
    wikidataId: WD_PARTIES.GROUPE_LFI_AN,
    partyWikidataId: WD_PARTIES.LFI,
  },
  SOC: {
    code: "SOC",
    name: "Socialistes et apparentés",
    color: "#FF8080",
    politicalPosition: "LEFT",
    wikidataId: WD_PARTIES.GROUPE_SOC_AN,
    partyWikidataId: WD_PARTIES.PS,
  },
  EPR: {
    code: "EPR",
    name: "Ensemble pour la République",
    color: "#FFEB00",
    politicalPosition: "CENTER",
    wikidataId: WD_PARTIES.GROUPE_EPR_AN,
    partyWikidataId: WD_PARTIES.RE,
  },
  DR: {
    code: "DR",
    name: "Droite Républicaine",
    color: "#0066CC",
    politicalPosition: "RIGHT",
    wikidataId: WD_PARTIES.GROUPE_DR_AN,
    partyWikidataId: WD_PARTIES.LR,
  },
  DEM: {
    code: "DEM",
    name: "Les Démocrates",
    color: "#FF9900",
    politicalPosition: "CENTER",
    wikidataId: WD_PARTIES.GROUPE_DEM_AN,
    partyWikidataId: WD_PARTIES.MODEM,
  },
  HOR: {
    code: "HOR",
    name: "Horizons & Indépendants",
    color: "#0001AA",
    politicalPosition: "CENTER_RIGHT",
    partyWikidataId: WD_PARTIES.HORIZONS,
  },
  LIOT: {
    code: "LIOT",
    name: "Libertés, Indépendants, Outre-mer et Territoires",
    color: "#AADDFF",
    politicalPosition: "CENTER",
    // Transpartisan group — no single party mapping
  },
  ECOS: {
    code: "ECOS",
    name: "Écologiste et Social",
    color: "#00C000",
    politicalPosition: "LEFT",
    wikidataId: WD_PARTIES.GROUPE_ECOS_AN,
    partyWikidataId: WD_PARTIES.EELV,
  },
  GDR: {
    code: "GDR",
    name: "Gauche Démocrate et Républicaine",
    color: "#DD0000",
    politicalPosition: "FAR_LEFT",
    wikidataId: WD_PARTIES.GROUPE_GDR_AN,
    partyWikidataId: WD_PARTIES.PCF,
  },
  UDR: {
    code: "UDR",
    name: "Union des Droites pour la République",
    color: "#8040C0",
    politicalPosition: "FAR_RIGHT",
    // Mixed group (ex-RN dissidents + others) — no single party
  },
  // Alternate code used in CSV (UDDPLR)
  UDDPLR: {
    code: "UDR",
    name: "Union des Droites pour la République",
    shortName: "UDR",
    color: "#8040C0",
    politicalPosition: "FAR_RIGHT",
  },
  NI: {
    code: "NI",
    name: "Non-inscrits",
    color: "#AAAAAA",
    // No party mapping — non-inscrits by definition
  },
};

// ============================================
// SÉNAT
// ============================================

export const SENATE_GROUPS: Record<string, ParliamentaryGroupConfig> = {
  LR: {
    code: "LR",
    name: "Les Républicains",
    color: "#0066CC",
    politicalPosition: "RIGHT",
    partyWikidataId: WD_PARTIES.LR,
  },
  SER: {
    code: "SER",
    name: "Socialiste, Écologiste et Républicain",
    color: "#FF8080",
    politicalPosition: "LEFT",
    partyWikidataId: WD_PARTIES.PS,
  },
  "CRCE-K": {
    code: "CRCE-K",
    name: "Communiste, Républicain, Citoyen et Écologiste - Kanaky",
    shortName: "CRCE",
    color: "#DD0000",
    politicalPosition: "FAR_LEFT",
    partyWikidataId: WD_PARTIES.PCF,
  },
  CRCE: {
    code: "CRCE",
    name: "Communiste, Républicain, Citoyen et Écologiste",
    color: "#DD0000",
    politicalPosition: "FAR_LEFT",
    partyWikidataId: WD_PARTIES.PCF,
  },
  GEST: {
    code: "GEST",
    name: "Écologiste - Solidarité et Territoires",
    color: "#00C000",
    politicalPosition: "LEFT",
    partyWikidataId: WD_PARTIES.EELV,
  },
  RDPI: {
    code: "RDPI",
    name: "Rassemblement des démocrates progressistes et indépendants",
    color: "#FFEB00",
    politicalPosition: "CENTER",
    partyWikidataId: WD_PARTIES.RE,
  },
  RASNAG: {
    code: "RASNAG",
    name: "Rassemblement National",
    shortName: "RN",
    color: "#0D378A",
    politicalPosition: "FAR_RIGHT",
    partyWikidataId: WD_PARTIES.RN,
  },
  RN: {
    code: "RN",
    name: "Rassemblement National",
    color: "#0D378A",
    politicalPosition: "FAR_RIGHT",
    partyWikidataId: WD_PARTIES.RN,
  },
  UC: {
    code: "UC",
    name: "Union Centriste",
    color: "#FF9900",
    politicalPosition: "CENTER_RIGHT",
    // Mixed group (UDI/MoDem/Horizons) — no single party
  },
  RDSE: {
    code: "RDSE",
    name: "Rassemblement Démocratique et Social Européen",
    color: "#F0A000",
    politicalPosition: "CENTER_LEFT",
    // Mixed group — no single party
  },
  INDEP: {
    code: "INDEP",
    name: "Les Indépendants - République et Territoires",
    color: "#00AAAA",
    politicalPosition: "CENTER_RIGHT",
    // Mixed group — no single party
  },
  NI: {
    code: "NI",
    name: "Non-inscrits",
    color: "#AAAAAA",
  },
  SENRI: {
    code: "NI",
    name: "Sénateurs ne figurant sur la liste d'aucun groupe",
    shortName: "NI",
    color: "#AAAAAA",
  },
  // Historical group (may appear in older data)
  UMP: {
    code: "UMP",
    name: "Union pour un Mouvement Populaire",
    color: "#0066CC",
    politicalPosition: "RIGHT",
    partyWikidataId: WD_PARTIES.LR, // UMP dissolved 2015, successor = LR
  },
};

/**
 * Get group config by code and chamber.
 * Falls back to assembly groups if chamber is not specified.
 */
export function getParliamentaryGroupConfig(
  code: string,
  chamber: "AN" | "SENAT" = "AN"
): ParliamentaryGroupConfig | undefined {
  if (chamber === "SENAT") {
    return SENATE_GROUPS[code];
  }
  return ASSEMBLY_GROUPS[code];
}

/**
 * Get all unique group configs for a given chamber.
 * Deduplicates entries that map to the same code (e.g. UDDPLR → UDR).
 */
export function getAllGroupConfigs(chamber: "AN" | "SENAT"): ParliamentaryGroupConfig[] {
  const groups = chamber === "AN" ? ASSEMBLY_GROUPS : SENATE_GROUPS;
  const seenCodes = new Set<string>();
  const seenNames = new Set<string>();
  const result: ParliamentaryGroupConfig[] = [];

  for (const config of Object.values(groups)) {
    if (!seenCodes.has(config.code) && !seenNames.has(config.name)) {
      seenCodes.add(config.code);
      seenNames.add(config.name);
      result.push(config);
    }
  }

  return result;
}
