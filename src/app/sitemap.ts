import { MetadataRoute } from "next";
import { db } from "@/lib/db";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://transparence-politique.fr";

// French departments
const DEPARTMENTS = [
  "Ain",
  "Aisne",
  "Allier",
  "Alpes-de-Haute-Provence",
  "Hautes-Alpes",
  "Alpes-Maritimes",
  "Ardèche",
  "Ardennes",
  "Ariège",
  "Aube",
  "Aude",
  "Aveyron",
  "Bouches-du-Rhône",
  "Calvados",
  "Cantal",
  "Charente",
  "Charente-Maritime",
  "Cher",
  "Corrèze",
  "Corse-du-Sud",
  "Haute-Corse",
  "Côte-d'Or",
  "Côtes-d'Armor",
  "Creuse",
  "Dordogne",
  "Doubs",
  "Drôme",
  "Eure",
  "Eure-et-Loir",
  "Finistère",
  "Gard",
  "Haute-Garonne",
  "Gers",
  "Gironde",
  "Hérault",
  "Ille-et-Vilaine",
  "Indre",
  "Indre-et-Loire",
  "Isère",
  "Jura",
  "Landes",
  "Loir-et-Cher",
  "Loire",
  "Haute-Loire",
  "Loire-Atlantique",
  "Loiret",
  "Lot",
  "Lot-et-Garonne",
  "Lozère",
  "Maine-et-Loire",
  "Manche",
  "Marne",
  "Haute-Marne",
  "Mayenne",
  "Meurthe-et-Moselle",
  "Meuse",
  "Morbihan",
  "Moselle",
  "Nièvre",
  "Nord",
  "Oise",
  "Orne",
  "Pas-de-Calais",
  "Puy-de-Dôme",
  "Pyrénées-Atlantiques",
  "Hautes-Pyrénées",
  "Pyrénées-Orientales",
  "Bas-Rhin",
  "Haut-Rhin",
  "Rhône",
  "Haute-Saône",
  "Saône-et-Loire",
  "Sarthe",
  "Savoie",
  "Haute-Savoie",
  "Paris",
  "Seine-Maritime",
  "Seine-et-Marne",
  "Yvelines",
  "Deux-Sèvres",
  "Somme",
  "Tarn",
  "Tarn-et-Garonne",
  "Var",
  "Vaucluse",
  "Vendée",
  "Vienne",
  "Haute-Vienne",
  "Vosges",
  "Yonne",
  "Territoire de Belfort",
  "Essonne",
  "Hauts-de-Seine",
  "Seine-Saint-Denis",
  "Val-de-Marne",
  "Val-d'Oise",
  "Guadeloupe",
  "Martinique",
  "Guyane",
  "La Réunion",
  "Mayotte",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Get all politicians
  const politicians = await db.politician.findMany({
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  // Get all parties with members
  const parties = await db.party.findMany({
    where: { politicians: { some: {} } },
    select: { slug: true, updatedAt: true },
  });

  // Get all scrutins with slugs
  const scrutins = await db.scrutin.findMany({
    where: { slug: { not: null } },
    select: { slug: true, updatedAt: true },
    orderBy: { votingDate: "desc" },
  });

  // Get all legislative dossiers with slugs
  const dossiers = await db.legislativeDossier.findMany({
    where: { slug: { not: null } },
    select: { slug: true, updatedAt: true },
    orderBy: { filingDate: "desc" },
  });

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/politiques`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/partis`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/affaires`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/votes`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/assemblee`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/mon-depute`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/departements`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/statistiques`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/sources`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/mentions-legales`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  // Politicians pages
  const politicianPages: MetadataRoute.Sitemap = politicians.map((p) => ({
    url: `${baseUrl}/politiques/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // Party pages
  const partyPages: MetadataRoute.Sitemap = parties
    .filter((p) => p.slug)
    .map((p) => ({
      url: `${baseUrl}/partis/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

  // Department pages
  const departmentPages: MetadataRoute.Sitemap = DEPARTMENTS.map((dept) => ({
    url: `${baseUrl}/departements/${encodeURIComponent(dept)}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  // Scrutin (votes) pages - only those with slugs
  const scrutinPages: MetadataRoute.Sitemap = scrutins
    .filter((s) => s.slug)
    .map((s) => ({
      url: `${baseUrl}/votes/${s.slug}`,
      lastModified: s.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    }));

  // Legislative dossier pages - only those with slugs
  const dossierPages: MetadataRoute.Sitemap = dossiers
    .filter((d) => d.slug)
    .map((d) => ({
      url: `${baseUrl}/assemblee/${d.slug}`,
      lastModified: d.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

  return [
    ...staticPages,
    ...politicianPages,
    ...partyPages,
    ...departmentPages,
    ...scrutinPages,
    ...dossierPages,
  ];
}
