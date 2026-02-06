// Navigation configuration
// Simplified structure with 3 dropdowns + 2 CTAs + 1 icon

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

// Main navigation groups (3 dropdowns)
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Élus",
    items: [
      {
        href: "/politiques",
        label: "Tous les représentants",
        description: "Députés, sénateurs, ministres, eurodéputés",
      },
      {
        href: "/carte",
        label: "Carte de France",
        icon: "map",
        description: "Visualisez les élus par département",
      },
      {
        href: "/departements",
        label: "Par département",
        description: "Trouvez les élus de votre territoire",
      },
      {
        href: "/partis",
        label: "Partis politiques",
        description: "55+ partis avec leurs membres",
      },
    ],
  },
  {
    label: "Activité",
    items: [
      {
        href: "/assemblee",
        label: "En direct de l'Assemblée",
        icon: "live",
        description: "Textes en discussion",
      },
      {
        href: "/votes",
        label: "Votes parlementaires",
        description: "Scrutins et positions des élus",
      },
      {
        href: "/affaires",
        label: "Affaires judiciaires",
        description: "Dossiers documentés avec sources",
      },
      {
        href: "/presse",
        label: "Revue de presse",
        icon: "newspaper",
        description: "Articles Le Monde, Politico, Mediapart",
      },
    ],
  },
  {
    label: "Ressources",
    items: [
      {
        href: "/statistiques",
        label: "Statistiques",
        description: "Tableaux de bord et analyses",
      },
      {
        href: "/institutions",
        label: "Institutions",
        description: "Comprendre le système politique",
      },
      {
        href: "/sources",
        label: "Sources et méthodologie",
        description: "Transparence et crédibilité",
      },
      {
        href: "/docs/api",
        label: "Documentation API",
        description: "Accès programmatique aux données",
      },
    ],
  },
] as const;

// CTA buttons (separate from dropdowns)
export const CTA_COMPARER: NavItem = {
  href: "/comparer",
  label: "Comparer",
  description: "Comparez deux représentants",
};

export const CTA_MON_DEPUTE: NavItem = {
  href: "/mon-depute",
  label: "Mon député",
  description: "Trouvez votre député par code postal",
};

// Chat link (icon in header)
export const CHAT_LINK: NavItem = {
  href: "/chat",
  label: "Assistant IA",
  description: "Chatbot alimenté par nos données",
};

// Legacy export for backwards compatibility
export const CTA_LINK = CTA_MON_DEPUTE;

// Footer navigation (3 columns simplified)
export const FOOTER_SECTIONS = [
  {
    title: "Explorer",
    links: [
      { href: "/politiques", label: "Représentants" },
      { href: "/carte", label: "Carte" },
      { href: "/votes", label: "Votes" },
      { href: "/affaires", label: "Affaires" },
      { href: "/presse", label: "Presse" },
    ],
  },
  {
    title: "Comprendre",
    links: [
      { href: "/statistiques", label: "Statistiques" },
      { href: "/institutions", label: "Institutions" },
      { href: "/sources", label: "Sources" },
      { href: "/docs/api", label: "API" },
      { href: "/mentions-legales", label: "Mentions légales" },
    ],
  },
  {
    title: "Outils",
    links: [
      { href: "/comparer", label: "Comparer" },
      { href: "/mon-depute", label: "Mon député" },
      { href: "/chat", label: "Assistant IA" },
      { href: "/soutenir", label: "Nous soutenir" },
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
