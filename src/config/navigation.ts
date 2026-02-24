// Navigation configuration
// 2 top-level transparency links + 2 thematic dropdowns + 2 standalone CTAs

export interface NavItem {
  href: string;
  label: string;
  icon?: string;
  description?: string;
  /** If set, this item is only shown when the named feature flag is enabled */
  featureFlag?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

// Top-level transparency links (displayed as direct links, not in a dropdown)
export const NAV_TOP_LEVEL: NavItem[] = [
  {
    href: "/affaires",
    label: "Affaires",
    icon: "scale",
    description: "Dossiers judiciaires documentés avec sources",
  },
  {
    href: "/factchecks",
    label: "Fact-checks",
    icon: "shieldCheck",
    description: "Vérification des déclarations politiques",
  },
];

// Main navigation groups (2 thematic dropdowns)
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Politique",
    items: [
      {
        href: "/politiques",
        label: "Tous les représentants",
        description: "Députés, sénateurs, ministres, eurodéputés",
      },
      {
        href: "/partis",
        label: "Partis politiques",
        description: "Les partis et leurs membres",
      },
      {
        href: "/votes",
        label: "Votes parlementaires",
        description: "Scrutins et positions des élus",
      },
      {
        href: "/carte",
        label: "Carte de France",
        icon: "map",
        description: "Visualisez les élus par département",
        featureFlag: "CARTE_SECTION",
      },
      {
        href: "/mon-depute",
        label: "Mon député",
        icon: "mapPin",
        description: "Trouvez votre député par code postal",
        featureFlag: "MON_DEPUTE_SECTION",
      },
    ],
  },
  {
    label: "Données",
    items: [
      {
        href: "/statistiques",
        label: "Statistiques",
        description: "Tableaux de bord et analyses",
        featureFlag: "STATISTIQUES_SECTION",
      },
      {
        href: "/elections",
        label: "Calendrier électoral",
        description: "Dates et compte à rebours des prochaines élections",
      },
      {
        href: "/sources",
        label: "Sources et méthodologie",
        icon: "BookOpen",
        description: "Nos sources de données et notre approche",
      },
      {
        href: "/presse",
        label: "Revue de presse",
        icon: "newspaper",
        description: "Articles Le Monde, Politico, Mediapart",
        featureFlag: "PRESS_SECTION",
      },
      {
        href: "/assemblee",
        label: "Dossiers législatifs",
        icon: "live",
        description: "Textes en discussion à l'Assemblée",
        featureFlag: "ASSEMBLEE_SECTION",
      },
    ],
  },
] as const;

// CTA buttons (standalone actions in header)
export const CTA_COMPARER: NavItem = {
  href: "/comparer",
  label: "Comparer",
  description: "Comparez deux représentants",
  featureFlag: "COMPARISON_TOOL",
};

export const CTA_ASSISTANT: NavItem = {
  href: "/chat",
  label: "Assistant IA",
  description: "Chatbot alimenté par nos données",
  featureFlag: "CHATBOT_ENABLED",
};

// Legacy exports for backwards compatibility
export const CTA_MON_DEPUTE: NavItem = {
  href: "/mon-depute",
  label: "Mon député",
  description: "Trouvez votre député par code postal",
  featureFlag: "MON_DEPUTE_SECTION",
};
export const CHAT_LINK = CTA_ASSISTANT;
export const CTA_LINK = CTA_MON_DEPUTE;

// Footer navigation (3 columns)
export interface FooterSection {
  title: string;
  links: Array<{ href: string; label: string; featureFlag?: string }>;
}

export const FOOTER_SECTIONS: FooterSection[] = [
  {
    title: "Explorer",
    links: [
      { href: "/politiques", label: "Représentants" },
      { href: "/carte", label: "Carte", featureFlag: "CARTE_SECTION" },
      { href: "/votes", label: "Votes" },
      { href: "/affaires", label: "Affaires" },
      { href: "/factchecks", label: "Fact-checks" },
      { href: "/elections", label: "Élections" },
    ],
  },
  {
    title: "Comprendre",
    links: [
      { href: "/statistiques", label: "Statistiques", featureFlag: "STATISTIQUES_SECTION" },
      { href: "/institutions", label: "Institutions", featureFlag: "INSTITUTIONS_SECTION" },
      { href: "/sources", label: "Sources" },
      { href: "/docs/api", label: "API" },
      { href: "/mentions-legales", label: "Mentions légales" },
    ],
  },
  {
    title: "Outils",
    links: [
      { href: "/comparer", label: "Comparer", featureFlag: "COMPARISON_TOOL" },
      { href: "/mon-depute", label: "Mon député", featureFlag: "MON_DEPUTE_SECTION" },
      { href: "/chat", label: "Assistant IA", featureFlag: "CHATBOT_ENABLED" },
      { href: "/soutenir", label: "Nous soutenir" },
    ],
  },
];

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
