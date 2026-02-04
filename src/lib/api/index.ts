/**
 * API module exports
 */

export { HTTPClient, HTTPError, httpClient } from "./http-client";
export type { HTTPClientOptions, HTTPResponse, RequestOptions } from "./http-client";

export {
  WikidataService,
  wikidataService,
  WIKIDATA_PROPS,
  WIKIDATA_ENTITIES,
  POLITICAL_POSITIONS,
} from "./wikidata";
export type {
  WikidataServiceOptions,
  WikidataSearchResult,
  WikidataEntity,
  WikidataClaims,
  WikidataClaim,
  WikidataPosition,
} from "./wikidata";
