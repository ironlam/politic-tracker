// Navigation configuration
// 3 top-level links + 2 thematic dropdowns + icon tool rail

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

// Top-level links (displayed as direct links, not in a dropdown)
export const NAV_TOP_LEVEL: NavItem[] = [
  {
    href: "/recap",
    label: "Le Recap",
    icon: "calendarDays",
    description: "Synthèse hebdomadaire de la vie politique",
  },
  {
    href: "/statistiques",
    label: "Statistiques",
    icon: "barChart",
    description: "Tableaux de bord et analyses",
    featureFlag: "STATISTIQUES_SECTION",
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
    label: "Représentants",
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
        href: "/affaires",
        label: "Affaires judiciaires",
        icon: "scale",
        description: "Dossiers judiciaires documentés avec sources",
      },
      {
        href: "/elections",
        label: "Calendrier électoral",
        icon: "calendar",
        description: "Toutes les élections à venir et passées",
      },
      {
        href: "/elections/municipales-2026",
        label: "Municipales 2026",
        icon: "vote",
        description: "Candidats et listes dans votre commune",
        featureFlag: "MUNICIPALES_2026",
      },
      {
        href: "/elections/municipales-2026/maires",
        label: "Maires de France",
        icon: "landmark",
        description: "Annuaire des maires sortants",
        featureFlag: "MUNICIPALES_2026",
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
    label: "Parlement",
    items: [
      {
        href: "/votes",
        label: "Votes parlementaires",
        icon: "vote",
        description: "Scrutins et positions des élus",
      },
      {
        href: "/assemblee",
        label: "Dossiers législatifs",
        icon: "live",
        description: "Textes en discussion à l'Assemblée",
        featureFlag: "ASSEMBLEE_SECTION",
      },
      {
        href: "/declarations-et-patrimoine",
        label: "Patrimoine & déclarations",
        description: "Intérêts, patrimoine et participations des élus",
      },
    ],
  },
] as const;

// Icon-only tool buttons in the header utility rail
export const NAV_TOOLS: NavItem[] = [
  {
    href: "/carte",
    label: "Carte de France",
    icon: "map",
    description: "Visualisez les élus par département",
    featureFlag: "CARTE_SECTION",
  },
  {
    href: "/presse",
    label: "Revue de presse",
    icon: "newspaper",
    description: "Articles Le Monde, Politico, Mediapart",
    featureFlag: "PRESS_SECTION",
  },
  {
    href: "/mon-observatoire",
    label: "Mon Observatoire",
    icon: "telescope",
    description: "Suivez l'activité de vos représentants",
  },
  {
    href: "/comparer",
    label: "Comparer",
    icon: "arrowLeftRight",
    description: "Comparez des représentants, partis ou groupes parlementaires",
    featureFlag: "COMPARISON_TOOL",
  },
];

export const CTA_ASSISTANT: NavItem = {
  href: "/chat",
  label: "Assistant IA",
  description: "Chatbot alimenté par nos données",
  featureFlag: "CHATBOT_ENABLED",
};

// Legacy exports for backwards compatibility
export const CTA_COMPARER: NavItem = {
  href: "/comparer",
  label: "Comparer",
  description: "Comparez des représentants, partis ou groupes parlementaires",
  featureFlag: "COMPARISON_TOOL",
};
export const CTA_MON_DEPUTE: NavItem = {
  href: "/mon-depute",
  label: "Mon député",
  description: "Trouvez votre député par code postal",
  featureFlag: "MON_DEPUTE_SECTION",
};
export const CHAT_LINK = CTA_ASSISTANT;
export const CTA_LINK = CTA_MON_DEPUTE;

// Footer navigation (4 columns)
export interface FooterSection {
  title: string;
  links: Array<{ href: string; label: string; featureFlag?: string }>;
}

export const FOOTER_SECTIONS: FooterSection[] = [
  {
    title: "Représentants",
    links: [
      { href: "/politiques", label: "Tous les représentants" },
      { href: "/partis", label: "Partis politiques" },
      { href: "/affaires", label: "Affaires judiciaires" },
      { href: "/elections", label: "Élections" },
      {
        href: "/elections/municipales-2026",
        label: "Municipales 2026",
        featureFlag: "MUNICIPALES_2026",
      },
      { href: "/mon-depute", label: "Mon député", featureFlag: "MON_DEPUTE_SECTION" },
    ],
  },
  {
    title: "Parlement",
    links: [
      { href: "/votes", label: "Votes parlementaires" },
      { href: "/assemblee", label: "Dossiers législatifs", featureFlag: "ASSEMBLEE_SECTION" },
      { href: "/declarations-et-patrimoine", label: "Patrimoine & déclarations" },
      { href: "/factchecks", label: "Fact-checks" },
      { href: "/statistiques", label: "Statistiques", featureFlag: "STATISTIQUES_SECTION" },
    ],
  },
  {
    title: "Explorer",
    links: [
      { href: "/recap", label: "Le Recap" },
      { href: "/carte", label: "Carte de France", featureFlag: "CARTE_SECTION" },
      { href: "/presse", label: "Revue de presse", featureFlag: "PRESS_SECTION" },
      { href: "/departements", label: "Départements" },
      { href: "/recherche", label: "Recherche" },
      { href: "/mon-observatoire", label: "Mon Observatoire" },
    ],
  },
  {
    title: "Le projet",
    links: [
      { href: "/comparer", label: "Comparer", featureFlag: "COMPARISON_TOOL" },
      { href: "/chat", label: "Assistant IA", featureFlag: "CHATBOT_ENABLED" },
      { href: "/sources", label: "Sources et méthodologie" },
      { href: "/docs/api", label: "API" },
      { href: "/soutenir", label: "Nous soutenir" },
      { href: "/mentions-legales", label: "Mentions légales" },
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

// RSS feeds for footer
export const RSS_FEEDS = [
  { href: "/api/rss/affaires.xml", label: "Affaires" },
  { href: "/api/rss/votes.xml", label: "Votes" },
  { href: "/api/rss/factchecks.xml", label: "Fact-checks" },
] as const;

// Social media links for footer
export interface SocialLink {
  href: string;
  label: string;
  /** Lucide icon name, or "x" for custom SVG */
  icon: "x" | "bluesky" | "instagram" | "github";
}

export const SOCIAL_LINKS: SocialLink[] = [
  { href: "https://x.com/poligraph_fr", label: "X (Twitter)", icon: "x" },
  {
    href: "https://bsky.app/profile/poligraph-fr.bsky.social",
    label: "Bluesky",
    icon: "bluesky",
  },
  {
    href: "https://www.instagram.com/poligraph_fr",
    label: "Instagram",
    icon: "instagram",
  },
  {
    href: "https://github.com/ironlam/poligraph",
    label: "GitHub",
    icon: "github",
  },
];

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
