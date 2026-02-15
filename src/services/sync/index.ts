export { syncDeputies, getSyncStats } from "./deputies";
export { syncSenators, getSenatStats } from "./senators";
export { syncGovernment, getGovernmentStats } from "./government";
export { syncHATVP, getHATVPStats } from "./hatvp";
export { syncPhotos, getPhotoStats } from "./photos";
export { syncEuroparl, getEuroparlStats } from "./europarl";
export { syncRNEMaires, getRNEStats } from "./rne";
export { syncCandidaturesMunicipales, getCandidaturesStats } from "./candidatures";
export {
  fetchWikidataConvictions,
  importConviction,
  getWikidataAffairsStats,
  mapCrimeToCategory,
  parseName,
  findOrCreateParty,
  findOrCreatePolitician,
  upsertWikidataId,
} from "./wikidata-affairs";
export type {
  DeputeCSV,
  SyncResult,
  SenateurAPI,
  SenatSyncResult,
  GouvernementCSV,
  GouvernementSyncResult,
  HATVPCSV,
  HATVPSyncResult,
  EuroparlMEP,
  EuroparlSyncResult,
  MaireRNECSV,
  RNESyncResult,
  CandidatureMunicipaleCSV,
  CandidaturesSyncResult,
} from "./types";
export type { WikidataConvictionResult, ConvictionImportResult } from "./wikidata-affairs";
export { syncVotesAN, getVotesANStats } from "./votes-an";
export type { VotesANSyncStats } from "./votes-an";
export { syncVotesSenat, getVotesSenatStats, AVAILABLE_SESSIONS } from "./votes-senat";
export type { VotesSenatSyncStats } from "./votes-senat";
