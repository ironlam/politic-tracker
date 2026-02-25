import { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { DEPARTMENTS, getDepartmentSlug } from "@/config/departments";
import { getAllThemeSlugs } from "@/lib/theme-utils";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://poligraph.fr";

export async function generateSitemaps() {
  return [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
}

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const id = Number(await props.id);
  switch (id) {
    case 0:
      return buildStaticAndPoliticiansSitemap();
    case 1:
      return buildAffairsPartiesElectionsDepartmentsSitemap();
    case 2:
      return buildDossiersSitemap();
    case 3:
      return buildScrutinsWithSummarySitemap();
    case 4:
      return buildScrutinsWithoutSummarySitemap();
    default:
      return [];
  }
}

// Sitemap 0: Static pages + PUBLISHED politicians (priority 0.8-1.0)
async function buildStaticAndPoliticiansSitemap(): Promise<MetadataRoute.Sitemap> {
  const politicians = await db.politician.findMany({
    where: { publicationStatus: "PUBLISHED" },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

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
      priority: 0.8,
    },
    {
      url: `${baseUrl}/departements`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/statistiques`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/elections`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/factchecks`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/presse`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/carte`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/comparer`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/institutions`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/institutions/assemblee-nationale`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/sources`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/soutenir`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/mentions-legales`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.8,
    },
  ];

  const politicianPages: MetadataRoute.Sitemap = politicians.map((p) => ({
    url: `${baseUrl}/politiques/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...politicianPages];
}

// Sitemap 1: Affairs + parties + elections + departments (priority 0.6-0.7)
async function buildAffairsPartiesElectionsDepartmentsSitemap(): Promise<MetadataRoute.Sitemap> {
  const [affairs, parties, partiesWithAffairs, elections] = await Promise.all([
    db.affair.findMany({
      where: { publicationStatus: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
    db.party.findMany({
      where: { politicians: { some: {} } },
      select: { slug: true, updatedAt: true },
    }),
    db.party.findMany({
      where: {
        slug: { not: null },
        affairsAtTime: { some: { publicationStatus: "PUBLISHED" } },
      },
      select: { slug: true, updatedAt: true },
    }),
    db.election.findMany({
      select: { slug: true, updatedAt: true },
      orderBy: { round1Date: "desc" },
    }),
  ]);

  const affairPages: MetadataRoute.Sitemap = affairs.map((a) => ({
    url: `${baseUrl}/affaires/${a.slug}`,
    lastModified: a.updatedAt,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const partyPages: MetadataRoute.Sitemap = parties
    .filter((p) => p.slug)
    .map((p) => ({
      url: `${baseUrl}/partis/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

  const partyAffairPages: MetadataRoute.Sitemap = partiesWithAffairs
    .filter((p) => p.slug)
    .map((p) => ({
      url: `${baseUrl}/affaires/parti/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

  const electionPages: MetadataRoute.Sitemap = elections.map((e) => ({
    url: `${baseUrl}/elections/${e.slug}`,
    lastModified: e.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const departmentPages: MetadataRoute.Sitemap = Object.values(DEPARTMENTS).map((dept) => ({
    url: `${baseUrl}/departements/${getDepartmentSlug(dept.name)}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  const themePages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/votes/themes`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    ...getAllThemeSlugs().map((slug) => ({
      url: `${baseUrl}/votes/themes/${slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];

  return [
    ...affairPages,
    ...partyPages,
    ...partyAffairPages,
    ...electionPages,
    ...departmentPages,
    ...themePages,
  ];
}

// Sitemap 2: Legislative dossiers (priority 0.5-0.6)
async function buildDossiersSitemap(): Promise<MetadataRoute.Sitemap> {
  const dossiers = await db.legislativeDossier.findMany({
    where: { slug: { not: null } },
    select: { slug: true, updatedAt: true },
    orderBy: { filingDate: "desc" },
  });

  return dossiers
    .filter((d) => d.slug)
    .map((d) => ({
      url: `${baseUrl}/assemblee/${d.slug}`,
      lastModified: d.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));
}

// Sitemap 3: Scrutins WITH AI summary (priority 0.4)
async function buildScrutinsWithSummarySitemap(): Promise<MetadataRoute.Sitemap> {
  const scrutins = await db.scrutin.findMany({
    where: { slug: { not: null }, summary: { not: null } },
    select: { slug: true, updatedAt: true },
    orderBy: { votingDate: "desc" },
  });

  return scrutins
    .filter((s) => s.slug)
    .map((s) => ({
      url: `${baseUrl}/votes/${s.slug}`,
      lastModified: s.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.4,
    }));
}

// Sitemap 4: Scrutins WITHOUT AI summary (priority 0.2)
async function buildScrutinsWithoutSummarySitemap(): Promise<MetadataRoute.Sitemap> {
  const scrutins = await db.scrutin.findMany({
    where: { slug: { not: null }, summary: null },
    select: { slug: true, updatedAt: true },
    orderBy: { votingDate: "desc" },
  });

  return scrutins
    .filter((s) => s.slug)
    .map((s) => ({
      url: `${baseUrl}/votes/${s.slug}`,
      lastModified: s.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.2,
    }));
}
