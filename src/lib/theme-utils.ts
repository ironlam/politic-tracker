import { ThemeCategory } from "@/generated/prisma";

const THEME_SLUGS: Record<string, ThemeCategory> = {
  "economie-budget": "ECONOMIE_BUDGET",
  "social-travail": "SOCIAL_TRAVAIL",
  "securite-justice": "SECURITE_JUSTICE",
  "environnement-energie": "ENVIRONNEMENT_ENERGIE",
  sante: "SANTE",
  "education-culture": "EDUCATION_CULTURE",
  institutions: "INSTITUTIONS",
  "affaires-etrangeres-defense": "AFFAIRES_ETRANGERES_DEFENSE",
  "numerique-tech": "NUMERIQUE_TECH",
  immigration: "IMMIGRATION",
  "agriculture-alimentation": "AGRICULTURE_ALIMENTATION",
  "logement-urbanisme": "LOGEMENT_URBANISME",
  transports: "TRANSPORTS",
};

export function themeFromSlug(slug: string): ThemeCategory | null {
  return THEME_SLUGS[slug] || null;
}

export function themeToSlug(theme: ThemeCategory): string {
  return theme.toLowerCase().replace(/_/g, "-");
}

export function getAllThemeSlugs(): string[] {
  return Object.keys(THEME_SLUGS);
}
