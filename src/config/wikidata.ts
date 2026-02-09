/**
 * Centralized Wikidata Q-IDs and property references
 *
 * This file is the SINGLE SOURCE OF TRUTH for all Wikidata identifiers
 * used throughout the project. When adding new Wikidata integrations,
 * add the Q-IDs here first.
 *
 * How to find a Q-ID:
 *   1. Quick: npm run wikidata:lookup -- "Jean-Luc Mélenchon"
 *   2. Manual: https://www.wikidata.org/w/api.php?action=wbsearchentities&search=NAME&language=fr&format=json
 *   3. Browse: https://www.wikidata.org/wiki/QXXXXX
 */

// ============================================================================
// PROPERTIES (P-IDs)
// ============================================================================

export const WD_PROPS = {
  // Core
  INSTANCE_OF: "P31",
  SUBCLASS_OF: "P279",

  // Person
  SEX_OR_GENDER: "P21",
  NATIONALITY: "P27",
  BIRTH_DATE: "P569",
  DEATH_DATE: "P570",
  IMAGE: "P18",
  OCCUPATION: "P106",

  // Political
  POSITION_HELD: "P39",
  POLITICAL_PARTY: "P102",
  PARLIAMENTARY_GROUP: "P4100",
  CHAIRPERSON: "P488",
  FOUNDED_BY: "P112",

  // Qualifiers
  START_TIME: "P580",
  END_TIME: "P582",
  OF: "P642", // "of" qualifier (e.g. president OF this organization)
  APPLIES_TO: "P2389", // alternative to P642 in some cases

  // Identifiers
  AN_ID: "P4123", // Assemblée nationale
  SENAT_ID: "P4324", // Sénat
  HATVP_ID: "P8919", // HATVP
  NOSDEPUTES_ID: "P7384", // NosDéputés.fr
} as const;

// ============================================================================
// ENTITIES (Q-IDs) — Generic
// ============================================================================

export const WD_ENTITIES = {
  HUMAN: "Q5",
  FRANCE: "Q142",
  POLITICAL_PARTY: "Q7278",
} as const;

// ============================================================================
// POSITIONS (Q-IDs) — French political positions
// ============================================================================

export const WD_POSITIONS = {
  // National executive
  PRESIDENT_REPUBLIQUE: "Q30461",
  PREMIER_MINISTRE: "Q1587677",
  MINISTRE: "Q83307",
  SECRETAIRE_ETAT: "Q26261727",

  // Deputies (several Q-IDs exist)
  DEPUTE: ["Q3044918", "Q21032547", "Q18941264", "Q55648587", "Q104728949"],
  // Senators
  SENATEUR: ["Q3044923", "Q18558628"],
  // European Parliament
  DEPUTE_EUROPEEN: ["Q27169", "Q2824658"],

  // Local
  MAIRE: "Q30185",
  ADJOINT_MAIRE: "Q382617",
  PRESIDENT_REGION: "Q19546",
  PRESIDENT_DEPARTEMENT: "Q1805817",
  CONSEILLER_REGIONAL: "Q1162444",
  CONSEILLER_DEPARTEMENTAL: "Q21032554",
  CONSEILLER_MUNICIPAL: "Q17519573",

  // Chamber roles (not separate mandates, roles on existing mandates)
  PRESIDENT_AN: "Q2824697",
  PRESIDENT_SENAT: "Q42512885",
  VP_AN: "Q19600701",
  VP_SENAT: "Q56055912",

  // Party leadership (generic positions)
  PARTY_LEADER: "Q1553195", // dirigeant de parti politique
  PRESIDENT_GENERIC: "Q1255921", // président ou présidente
  COORDINATOR: "Q20481199",
  SECRETAIRE_GENERAL: "Q6501749",
  SECRETAIRE_NATIONAL: "Q88551455",

  // Party leadership (specific positions)
  PREMIER_SECRETAIRE_PS: "Q747123",
  SECRETAIRE_NATIONAL_EELV: "Q3477315",
} as const;

// ============================================================================
// FRENCH POLITICAL PARTIES (Q-IDs)
// ============================================================================

export const WD_PARTIES = {
  // Major parties (current)
  RN: "Q485840", // Rassemblement National (parti, pas le groupe AN)
  LFI: "Q27978402", // La France Insoumise
  RE: "Q23731823", // Renaissance
  LR: "Q20012759", // Les Républicains
  PS: "Q170972", // Parti Socialiste
  EELV: "Q613786", // Les Écologistes (EELV)
  PCF: "Q192821", // Parti Communiste Français
  MODEM: "Q587370", // Mouvement Démocrate
  RECONQUETE: "Q109932430", // Reconquête
  HORIZONS: "Q108055027",
  UDI: "Q3549087", // Union des Démocrates et Indépendants

  // Parliamentary groups (different from parties!)
  GROUPE_RN_AN: "Q205150", // Groupe RN à l'AN
  GROUPE_LFI_AN: "Q20905918", // Groupe LFI-NFP à l'AN
  GROUPE_EPR_AN: "Q110797741", // Groupe EPR (Ensemble)
  GROUPE_DR_AN: "Q829126", // Groupe DR (Droite Républicaine)
  GROUPE_DEM_AN: "Q3277601", // Groupe Démocrate
  GROUPE_SOC_AN: "Q151614", // Groupe SOC
  GROUPE_ECOS_AN: "Q211595", // Groupe Écologiste et Social
  GROUPE_GDR_AN: "Q121596", // Groupe GDR

  // Historical parties
  UMP: "Q210040",
  FN: "Q1397970", // Front National (ancien RN)
  LREM: "Q25046822", // En Marche (ancien RE)
  RPR: "Q212648",
  UDF: "Q233647",
} as const;
