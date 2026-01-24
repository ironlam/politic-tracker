// Navigation links shared between Header and MobileMenu
export const NAV_LINKS = [
  { href: "/mon-depute", label: "Mon député" },
  { href: "/politiques", label: "Représentants" },
  { href: "/departements", label: "Départements" },
  { href: "/partis", label: "Partis" },
  { href: "/affaires", label: "Affaires" },
  { href: "/statistiques", label: "Statistiques" },
] as const;

export type NavLink = (typeof NAV_LINKS)[number];
