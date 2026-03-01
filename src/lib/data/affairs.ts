import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import {
  getCategoriesForSuper,
  CATEGORY_TO_SUPER,
  type AffairSuperCategory,
} from "@/config/labels";
import type { AffairStatus, AffairCategory, AffairSeverity, Involvement } from "@/types";

export async function getPartiesWithAffairs() {
  "use cache";
  cacheTag("affairs", "parties");
  cacheLife("minutes");

  const parties = await db.party.findMany({
    where: {
      affairsAtTime: {
        some: { publicationStatus: "PUBLISHED" },
      },
      slug: { not: null },
    },
    select: {
      slug: true,
      shortName: true,
      name: true,
      color: true,
      _count: {
        select: { affairsAtTime: { where: { publicationStatus: "PUBLISHED" } } },
      },
    },
    orderBy: { shortName: "asc" },
  });

  return parties;
}

// Tier 1: Core query — accepts free-text search (never cached directly)
async function queryAffairs(
  search?: string,
  status?: string,
  superCategory?: AffairSuperCategory,
  category?: string,
  severity?: AffairSeverity,
  page = 1,
  involvements: Involvement[] = ["DIRECT"],
  partySlug?: string,
  sort?: string
) {
  const limit = 20;
  const skip = (page - 1) * limit;

  // Build category filter based on super-category or specific category
  let categoryFilter: AffairCategory[] | undefined;
  if (category) {
    categoryFilter = [category as AffairCategory];
  } else if (superCategory) {
    categoryFilter = getCategoriesForSuper(superCategory);
  }

  const where = {
    publicationStatus: "PUBLISHED" as const,
    involvement: { in: involvements },
    ...(status && { status: status as AffairStatus }),
    ...(categoryFilter && { category: { in: categoryFilter } }),
    ...(severity && { severity }),
    ...(partySlug && { partyAtTime: { slug: partySlug } }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: "insensitive" as const } },
        { description: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  };

  const orderBy =
    sort === "date-desc"
      ? [
          { verdictDate: { sort: "desc" as const, nulls: "last" as const } },
          { startDate: { sort: "desc" as const, nulls: "last" as const } },
          { createdAt: "desc" as const },
        ]
      : sort === "date-asc"
        ? [
            { verdictDate: { sort: "asc" as const, nulls: "last" as const } },
            { startDate: { sort: "asc" as const, nulls: "last" as const } },
            { createdAt: "asc" as const },
          ]
        : [
            { severity: "asc" as const },
            { verdictDate: { sort: "desc" as const, nulls: "last" as const } },
            { startDate: { sort: "desc" as const, nulls: "last" as const } },
            { createdAt: "desc" as const },
          ];

  const [affairs, total] = await Promise.all([
    db.affair.findMany({
      where,
      include: {
        politician: {
          select: { id: true, fullName: true, slug: true, currentParty: true },
        },
        partyAtTime: {
          select: { id: true, slug: true, shortName: true, name: true, color: true },
        },
        sources: { select: { id: true }, take: 1 },
      },
      orderBy,
      skip,
      take: limit,
    }),
    db.affair.count({ where }),
  ]);

  return {
    affairs,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

// Tier 2: Cached path — bounded params only (no free-text search)
export async function getAffairsFiltered(
  status?: string,
  superCategory?: AffairSuperCategory,
  category?: string,
  severity?: AffairSeverity,
  page = 1,
  involvements: Involvement[] = ["DIRECT"],
  partySlug?: string,
  sort?: string
) {
  "use cache";
  cacheTag("affairs");
  cacheLife("minutes");
  return queryAffairs(
    undefined,
    status,
    superCategory,
    category,
    severity,
    page,
    involvements,
    partySlug,
    sort
  );
}

// Tier 3: Uncached path — free-text search
export async function searchAffairs(
  search: string,
  status?: string,
  superCategory?: AffairSuperCategory,
  category?: string,
  severity?: AffairSeverity,
  page = 1,
  involvements: Involvement[] = ["DIRECT"],
  partySlug?: string,
  sort?: string
) {
  return queryAffairs(
    search,
    status,
    superCategory,
    category,
    severity,
    page,
    involvements,
    partySlug,
    sort
  );
}

// Router — decides cached vs uncached
export async function getAffairs(
  search?: string,
  status?: string,
  superCategory?: AffairSuperCategory,
  category?: string,
  severity?: AffairSeverity,
  page = 1,
  involvements: Involvement[] = ["DIRECT"],
  partySlug?: string,
  sort?: string
) {
  if (search) {
    return searchAffairs(
      search,
      status,
      superCategory,
      category,
      severity,
      page,
      involvements,
      partySlug,
      sort
    );
  }
  return getAffairsFiltered(
    status,
    superCategory,
    category,
    severity,
    page,
    involvements,
    partySlug,
    sort
  );
}

export async function getSuperCategoryCounts() {
  "use cache";
  cacheTag("affairs");
  cacheLife("minutes");

  const categoryCounts = await db.affair.groupBy({
    by: ["category"],
    where: { publicationStatus: "PUBLISHED", involvement: "DIRECT" },
    _count: { category: true },
  });

  // Aggregate by super-category
  const superCounts: Record<string, number> = {
    PROBITE: 0,
    FINANCES: 0,
    PERSONNES: 0,
    EXPRESSION: 0,
    AUTRE: 0,
  };

  for (const { category, _count } of categoryCounts) {
    const superCat = CATEGORY_TO_SUPER[category as AffairCategory];
    if (superCat) {
      superCounts[superCat] += _count.category;
    }
  }

  return superCounts;
}

export async function getStatusCounts() {
  "use cache";
  cacheTag("affairs");
  cacheLife("minutes");

  const statusCounts = await db.affair.groupBy({
    by: ["status"],
    where: { publicationStatus: "PUBLISHED", involvement: "DIRECT" },
    _count: { status: true },
  });

  return Object.fromEntries(statusCounts.map((s) => [s.status, s._count.status]));
}

export async function getSeverityCounts() {
  "use cache";
  cacheTag("affairs");
  cacheLife("minutes");

  const severityCounts = await db.affair.groupBy({
    by: ["severity"],
    where: { publicationStatus: "PUBLISHED", involvement: "DIRECT" },
    _count: { severity: true },
  });

  return Object.fromEntries(severityCounts.map((s) => [s.severity, s._count.severity])) as Record<
    string,
    number
  >;
}
