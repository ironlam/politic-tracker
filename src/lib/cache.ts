import { revalidatePath, revalidateTag } from "next/cache";

// ─── Cache tiers for API responses ────────────────────────────────

export type CacheTier = "static" | "daily" | "stats" | "none";

const CACHE_HEADERS: Record<CacheTier, string> = {
  static: "public, s-maxage=3600, stale-while-revalidate=600",
  daily: "public, s-maxage=300, stale-while-revalidate=120",
  stats: "public, s-maxage=900, stale-while-revalidate=300",
  none: "no-store",
};

/**
 * Set Cache-Control headers on a NextResponse.
 * Only call on successful (2xx) responses.
 */
export function withCache(response: Response, tier: CacheTier): Response {
  response.headers.set("Cache-Control", CACHE_HEADERS[tier]);
  return response;
}

// ─── Entity-based invalidation ────────────────────────────────────

export type EntityType =
  | "politician"
  | "party"
  | "affair"
  | "mandate"
  | "vote"
  | "dossier"
  | "factcheck"
  | "stats"
  | "election";

// Cache life profile used by "use cache" functions — must match cacheLife() calls
const CACHE_PROFILE = "minutes";

/**
 * Invalidate CDN cache and data cache for a given entity.
 * Call after admin mutations or sync operations.
 */
export function invalidateEntity(type: EntityType, slug?: string): void {
  switch (type) {
    case "politician":
      revalidatePath("/api/politiques", "layout");
      if (slug) {
        revalidatePath(`/api/politiques/${slug}`, "layout");
        revalidatePath(`/api/politiques/${slug}/votes`, "layout");
        revalidatePath(`/api/politiques/${slug}/affaires`, "layout");
        revalidatePath(`/api/politiques/${slug}/relations`, "layout");
        revalidatePath(`/api/politiques/${slug}/factchecks`, "layout");
        revalidateTag(`politician:${slug}`, CACHE_PROFILE);
      }
      revalidateTag("politicians", CACHE_PROFILE);
      break;

    case "party":
      revalidatePath("/api/partis", "layout");
      if (slug) {
        revalidatePath(`/api/partis/${slug}`, "layout");
        revalidateTag(`party:${slug}`, CACHE_PROFILE);
      }
      revalidateTag("parties", CACHE_PROFILE);
      break;

    case "affair":
      revalidatePath("/api/affaires", "layout");
      break;

    case "mandate":
      revalidatePath("/api/mandats", "layout");
      revalidatePath("/api/deputies/by-department", "layout");
      revalidateTag("politicians", CACHE_PROFILE);
      break;

    case "vote":
      revalidatePath("/api/votes", "layout");
      revalidateTag("votes", CACHE_PROFILE);
      break;

    case "factcheck":
      if (slug) {
        revalidateTag(`factcheck:${slug}`, CACHE_PROFILE);
      }
      revalidateTag("factchecks", CACHE_PROFILE);
      break;

    case "dossier":
      revalidateTag("dossiers", CACHE_PROFILE);
      break;

    case "stats":
      revalidatePath("/api/votes/stats", "layout");
      revalidatePath("/api/stats/departments", "layout");
      revalidateTag("stats", CACHE_PROFILE);
      break;

    case "election":
      revalidateTag("elections", CACHE_PROFILE);
      break;
  }
}

// ─── Global revalidation (post-sync) ─────────────────────────────

export const ALL_TAGS = [
  "politicians",
  "parties",
  "votes",
  "stats",
  "dossiers",
  "factchecks",
  "elections",
] as const;

export type CacheTag = (typeof ALL_TAGS)[number];

/**
 * Purge all main cache tags. Call after full sync operations.
 */
export function revalidateAll(): void {
  for (const tag of ALL_TAGS) {
    revalidateTag(tag, CACHE_PROFILE);
  }
}

/**
 * Revalidate specific tags by name.
 */
export function revalidateTags(tags: string[]): void {
  for (const tag of tags) {
    revalidateTag(tag, CACHE_PROFILE);
  }
}
