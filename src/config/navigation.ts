// Navigation configuration
// Organized with dropdown menus for better UX

export interface NavItem {
  href: string;
  label: string;
  icon?: string;
  description?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

// Main navigation groups (dropdowns)
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Élus",
    items: [
      { href: "/politiques", label: "Tous les représentants", description: "Députés, sénateurs, ministres..." },
      { href: "/carte", label: "Carte de France", icon: "🗺️", description: "Visualisez les élus par département" },
      { href: "/departements", label: "Par département", description: "Trouvez les élus de votre territoire" },
      { href: "/partis", label: "Partis politiques", description: "55+ partis avec leurs membres" },
    ],
  },
  {
    label: "Travaux",
    items: [
      { href: "/assemblee", label: "En direct", icon: "🔴", description: "Textes en discussion à l'Assemblée" },
      { href: "/votes", label: "Votes parlementaires", description: "Scrutins et positions des députés" },
      { href: "/affaires", label: "Affaires judiciaires", description: "Dossiers documentés avec sources" },
    ],
  },
  {
    label: "Données",
    items: [
      { href: "/statistiques", label: "Statistiques", description: "Tableaux de bord et analyses" },
      { href: "/institutions", label: "Institutions", description: "Comprendre le système politique" },
      { href: "/sources", label: "Sources", description: "Méthodologie et transparence" },
      { href: "/docs/api", label: "API", description: "Accès programmatique aux données" },
    ],
  },
  {
    label: "Assistant IA",
    items: [
      { href: "/chat", label: "Poser une question", icon: "💬", description: "Chatbot alimenté par nos données" },
    ],
  },
] as const;

// CTA button (separate from dropdowns)
export const CTA_LINK: NavItem = {
  href: "/mon-depute",
  label: "Mon député",
  description: "Trouvez votre député par code postal",
};

// Footer navigation (reorganized)
export const FOOTER_SECTIONS = [
  {
    title: "Explorer",
    links: [
      { href: "/politiques", label: "Représentants" },
      { href: "/carte", label: "Carte" },
      { href: "/assemblee", label: "En direct" },
      { href: "/votes", label: "Votes" },
      { href: "/affaires", label: "Affaires" },
      { href: "/partis", label: "Partis" },
    ],
  },
  {
    title: "Comprendre",
    links: [
      { href: "/statistiques", label: "Statistiques" },
      { href: "/institutions", label: "Institutions" },
      { href: "/sources", label: "Sources" },
      { href: "/chat", label: "Assistant IA" },
    ],
  },
  {
    title: "Technique",
    links: [
      { href: "/docs/api", label: "Documentation API" },
      { href: "https://github.com/ironlam/politic-tracker", label: "GitHub", external: true },
      { href: "/mentions-legales", label: "Mentions légales" },
    ],
  },
] as const;

// External data sources for footer
export const DATA_SOURCES = [
  { href: "https://data.assemblee-nationale.fr", label: "Assemblée nationale" },
  { href: "https://www.senat.fr/open-data", label: "Sénat" },
  { href: "https://www.hatvp.fr", label: "HATVP" },
] as const;

// Legacy exports for backwards compatibility
export const NAV_LINKS = [
  { href: "/politiques", label: "Représentants" },
  { href: "/votes", label: "Votes" },
  { href: "/affaires", label: "Affaires" },
  { href: "/partis", label: "Partis" },
  { href: "/statistiques", label: "Stats" },
] as const;

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
