// Navigation links shared between Header and MobileMenu
// Organized by user priority: search > browse > analyze > learn

export const NAV_LINKS = [
  // Primary: Finding representatives
  { href: "/mon-depute", label: "Mon député" },
  { href: "/politiques", label: "Représentants" },
  // Secondary: Browsing data
  { href: "/votes", label: "Votes" },
  { href: "/affaires", label: "Affaires" },
  { href: "/partis", label: "Partis" },
  // Tertiary: Analysis & context
  { href: "/statistiques", label: "Stats" },
] as const;

// Footer-only links (less frequently accessed)
export const FOOTER_LINKS = [
  { href: "/recherche", label: "Recherche avancée" },
  { href: "/departements", label: "Départements" },
  { href: "/institutions", label: "Institutions" },
  { href: "/sources", label: "Sources" },
  { href: "/docs/api", label: "API" },
  { href: "/mentions-legales", label: "Mentions légales" },
] as const;

export type NavLink = (typeof NAV_LINKS)[number];
export type FooterLink = (typeof FOOTER_LINKS)[number];
