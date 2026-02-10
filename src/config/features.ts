/**
 * Feature flags - static, typed, deployed via Vercel (~1 min redeploy).
 *
 * To toggle a feature: change the value, push, done.
 * For anticipated elections: change FEATURED_ELECTION_SLUG.
 */

export const FEATURES = {
  /** Show featured election banner on the homepage */
  ELECTION_BANNER: true,
  /** Slug of the election highlighted on the homepage */
  FEATURED_ELECTION_SLUG: "municipales-2026",
  /** Show practical guide section on election detail pages */
  ELECTION_GUIDE_SECTION: true,
} as const;

export function isFeatureEnabled(key: keyof typeof FEATURES): boolean {
  return !!FEATURES[key];
}
