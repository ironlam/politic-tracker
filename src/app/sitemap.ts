import { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { DEPARTMENTS, getDepartmentSlug } from "@/config/departments";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://poligraph.fr";

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

  // Get all elections
  const elections = await db.election.findMany({
    select: { slug: true, updatedAt: true },
    orderBy: { round1Date: "desc" },
  });

  // Get all affairs with slugs
  const affairs = await db.affair.findMany({
    where: { publicationStatus: "PUBLISHED" },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  // Get parties with published affairs (for satellite pages)
  const partiesWithAffairs = await db.party.findMany({
    where: {
      slug: { not: null },
      affairsAtTime: { some: { publicationStatus: "PUBLISHED" } },
    },
    select: { slug: true, updatedAt: true },
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
      url: `${baseUrl}/elections`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/factchecks`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/presse`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/carte`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/comparer`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/institutions`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/institutions/assemblee-nationale`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/soutenir`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/chat`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
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
  const departmentPages: MetadataRoute.Sitemap = Object.values(DEPARTMENTS).map((dept) => ({
    url: `${baseUrl}/departements/${getDepartmentSlug(dept.name)}`,
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

  // Election pages
  const electionPages: MetadataRoute.Sitemap = elections.map((e) => ({
    url: `${baseUrl}/elections/${e.slug}`,
    lastModified: e.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  // Affair pages
  const affairPages: MetadataRoute.Sitemap = affairs.map((a) => ({
    url: `${baseUrl}/affaires/${a.slug}`,
    lastModified: a.updatedAt,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  // Party-affair satellite pages
  const partyAffairPages: MetadataRoute.Sitemap = partiesWithAffairs
    .filter((p) => p.slug)
    .map((p) => ({
      url: `${baseUrl}/affaires/parti/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

  return [
    ...staticPages,
    ...politicianPages,
    ...partyPages,
    ...departmentPages,
    ...scrutinPages,
    ...dossierPages,
    ...electionPages,
    ...affairPages,
    ...partyAffairPages,
  ];
}
