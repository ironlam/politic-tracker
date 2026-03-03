export const SOCIAL_CATEGORIES = [
  "votes",
  "consensus",
  "chiffres",
  "affaires",
  "factchecks",
  "profil",
  "elections",
  "presse",
  "presence",
] as const;

export type SocialCategory = (typeof SOCIAL_CATEGORIES)[number];

/** Categories requiring editorial review before posting */
export const SENSITIVE_CATEGORIES: SocialCategory[] = ["affaires", "factchecks"];

export function isSensitiveCategory(category: SocialCategory): boolean {
  return SENSITIVE_CATEGORIES.includes(category);
}

/** Kill switch — set SOCIAL_AUTO_POST=false to disable posting */
export function isAutoPostEnabled(): boolean {
  return process.env.SOCIAL_AUTO_POST !== "false";
}

export const SLACK_SOCIAL_WEBHOOK_URL = process.env.SLACK_SOCIAL_WEBHOOK_URL;
export { SITE_URL } from "@/config/site";
