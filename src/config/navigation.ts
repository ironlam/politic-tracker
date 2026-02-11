// Navigation configuration
// 3 thematic dropdowns + 2 standalone actions

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

// Main navigation groups (3 thematic dropdowns)
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
        href: "/mon-depute",
        label: "Mon député",
        icon: "mapPin",
        description: "Trouvez votre député par code postal",
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
    label: "Parlement",
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
        href: "/statistiques",
        label: "Statistiques",
        description: "Tableaux de bord et analyses",
      },
      {
        href: "/elections",
        label: "Calendrier électoral",
        description: "Dates et compte à rebours des prochaines élections",
      },
    ],
  },
  {
    label: "Transparence",
    items: [
      {
        href: "/factchecks",
        label: "Fact-checks",
        icon: "shieldCheck",
        description: "Vérification des déclarations politiques",
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
] as const;

// CTA buttons (standalone actions in header)
export const CTA_COMPARER: NavItem = {
  href: "/comparer",
  label: "Comparer",
  description: "Comparez deux représentants",
};

export const CTA_ASSISTANT: NavItem = {
  href: "/chat",
  label: "Assistant IA",
  description: "Chatbot alimenté par nos données",
};

// Legacy exports for backwards compatibility
export const CTA_MON_DEPUTE: NavItem = {
  href: "/mon-depute",
  label: "Mon député",
  description: "Trouvez votre député par code postal",
};
export const CHAT_LINK = CTA_ASSISTANT;
export const CTA_LINK = CTA_MON_DEPUTE;

// Footer navigation (3 columns)
export const FOOTER_SECTIONS = [
  {
    title: "Explorer",
    links: [
      { href: "/politiques", label: "Représentants" },
      { href: "/carte", label: "Carte" },
      { href: "/votes", label: "Votes" },
      { href: "/affaires", label: "Affaires" },
      { href: "/factchecks", label: "Fact-checks" },
      { href: "/elections", label: "Élections" },
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
  { href: "https://www.wikidata.org", label: "Wikidata" },
  { href: "https://www.europarl.europa.eu", label: "Parlement européen" },
  { href: "https://toolbox.google.com/factcheck/explorer", label: "Google Fact Check" },
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
