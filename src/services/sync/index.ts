export { syncDeputies, getSyncStats, fetchDeputiesCSV } from "./deputies";
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
export { syncFactchecks } from "./factchecks";
export type { FactcheckSyncOptions, FactcheckSyncStats } from "./factchecks";
export { syncPress } from "./press";
export type { PressSyncOptions, PressSyncStats } from "./press";
export { recalculateProminence } from "./prominence";
export type { ProminenceOptions, ProminenceStats } from "./prominence";
export { assignPublicationStatus } from "./publication-status";
export type { PublicationStatusOptions, PublicationStatusStats } from "./publication-status";
export { reconcileAffairs } from "./reconcile-affairs";
export type { ReconcileAffairsOptions, ReconcileAffairsStats } from "./reconcile-affairs";
export { classifyThemes } from "./classify-themes";
export type { ClassifyThemesOptions, ClassifyThemesStats } from "./classify-themes";
