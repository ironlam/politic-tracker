export { resolve, resolveBatch, scoreCandidate } from "./resolver";
export type {
  ResolveInput,
  ResolveResult,
  CandidateMatch,
  CachedPolitician,
  ScoringInput,
  BatchResolveInput,
  BatchResolveResult,
} from "./types";
export { IDENTITY_THRESHOLDS, BIRTHDATE_TOLERANCE_MS } from "./types";
