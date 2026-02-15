/**
 * Rate limits centralisés par source API.
 * Valeurs en millisecondes entre chaque requête.
 */

// --- Sources publiques ---
export const WIKIDATA_RATE_LIMIT_MS = 200; // REST API — policy officielle
export const WIKIDATA_SPARQL_RATE_LIMIT_MS = 300; // SPARQL — empirique, timeout fréquents
export const SENAT_RATE_LIMIT_MS = 200; // senat.fr — non documenté, politesse
export const LEGISLATION_RATE_LIMIT_MS = 300; // legifrance — non documenté
export const RSS_RATE_LIMIT_MS = 1000; // Flux RSS presse — politesse standard
export const FACTCHECK_RATE_LIMIT_MS = 200; // Google Fact Check Tools API

// --- IA (Claude/OpenAI) ---
export const AI_RATE_LIMIT_MS = 500; // Délai entre appels IA
export const AI_429_BACKOFF_MS = 30_000; // Backoff sur rate limit 429
