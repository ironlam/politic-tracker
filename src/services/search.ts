import { db } from "@/lib/db";
import { Prisma, MandateType } from "@/generated/prisma";

// FTS result type from raw query
interface FTSResult {
  id: string;
  slug: string;
  fullName: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  currentPartyId: string | null;
  relevance: number;
}

export interface SearchFilters {
  query: string;
  partyId?: string;
  mandateType?: MandateType;
  department?: string;
  hasAffairs?: boolean;
  isActive?: boolean;
}

export interface SearchResult {
  id: string;
  slug: string;
  fullName: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  currentParty: {
    id: string;
    shortName: string;
    color: string | null;
  } | null;
  currentMandate: {
    type: MandateType;
    constituency: string | null;
  } | null;
  affairsCount: number;
  relevance?: number;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  totalPages: number;
  suggestions?: string[];
}

/**
 * Search using PostgreSQL Full-Text Search
 * Uses the search_politicians function created in the FTS migration
 */
async function searchWithFTS(
  filters: SearchFilters,
  page: number,
  limit: number
): Promise<SearchResponse> {
  const { query, partyId, mandateType, department, hasAffairs, isActive } = filters;
  const skip = (page - 1) * limit;

  // Use raw SQL with FTS for text search
  // The search_politicians function handles accent-insensitive matching
  const ftsResults = await db.$queryRaw<FTSResult[]>`
    SELECT
      p.id,
      p.slug,
      p."fullName",
      p."firstName",
      p."lastName",
      p."photoUrl",
      p."currentPartyId",
      ts_rank(p."searchVector", plainto_tsquery('french', unaccent(${query}))) as relevance
    FROM "Politician" p
    WHERE p."searchVector" @@ plainto_tsquery('french', unaccent(${query}))
       OR p."fullName" ILIKE ${`%${query}%`}
       OR p."lastName" ILIKE ${`%${query}%`}
    ORDER BY relevance DESC, p."lastName" ASC
    LIMIT 500
  `;

  if (ftsResults.length === 0) {
    // No FTS results, generate suggestions
    const suggestions = await generateSuggestions(query);
    return {
      results: [],
      total: 0,
      page,
      totalPages: 0,
      suggestions,
    };
  }

  // Get all matching IDs
  let matchingIds = ftsResults.map((r) => r.id);

  // Apply additional filters using Prisma on the ID set
  if (partyId || mandateType || department || hasAffairs !== undefined || isActive !== undefined) {
    const additionalFilters: Prisma.PoliticianWhereInput[] = [{ id: { in: matchingIds } }];

    if (partyId) {
      additionalFilters.push({ currentPartyId: partyId });
    }

    if (mandateType) {
      additionalFilters.push({
        mandates: { some: { type: mandateType, isCurrent: true } },
      });
    }

    if (department) {
      additionalFilters.push({
        mandates: {
          some: { constituency: { startsWith: department, mode: "insensitive" }, isCurrent: true },
        },
      });
    }

    if (hasAffairs === true) {
      additionalFilters.push({ affairs: { some: {} } });
    } else if (hasAffairs === false) {
      additionalFilters.push({ affairs: { none: {} } });
    }

    if (isActive === true) {
      additionalFilters.push({ mandates: { some: { isCurrent: true } } });
    } else if (isActive === false) {
      additionalFilters.push({ mandates: { none: { isCurrent: true } } });
    }

    const filteredPoliticians = await db.politician.findMany({
      where: { AND: additionalFilters },
      select: { id: true },
    });

    matchingIds = filteredPoliticians.map((p) => p.id);
  }

  const total = matchingIds.length;

  // Get paginated results preserving FTS order
  const orderedIds = ftsResults
    .filter((r) => matchingIds.includes(r.id))
    .slice(skip, skip + limit)
    .map((r) => r.id);

  // Fetch full data for the page
  const politicians = await db.politician.findMany({
    where: { id: { in: orderedIds } },
    select: {
      id: true,
      slug: true,
      fullName: true,
      firstName: true,
      lastName: true,
      photoUrl: true,
      currentParty: {
        select: { id: true, shortName: true, color: true },
      },
      mandates: {
        where: { isCurrent: true },
        select: { type: true, constituency: true },
        take: 1,
      },
      _count: { select: { affairs: true } },
    },
  });

  // Reorder to match FTS relevance order
  const politicianMap = new Map(politicians.map((p) => [p.id, p]));
  const orderedPoliticians = orderedIds
    .map((id) => politicianMap.get(id))
    .filter(Boolean) as typeof politicians;

  const results: SearchResult[] = orderedPoliticians.map((p) => ({
    id: p.id,
    slug: p.slug,
    fullName: p.fullName,
    firstName: p.firstName,
    lastName: p.lastName,
    photoUrl: p.photoUrl,
    currentParty: p.currentParty,
    currentMandate: p.mandates[0] || null,
    affairsCount: p._count.affairs,
  }));

  return {
    results,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Advanced search using PostgreSQL full-text search for text queries,
 * combined with Prisma for other filters
 */
export async function searchPoliticians(
  filters: SearchFilters,
  page: number = 1,
  limit: number = 20
): Promise<SearchResponse> {
  const { query, partyId, mandateType, department, hasAffairs, isActive } = filters;
  const skip = (page - 1) * limit;

  // If we have a text query, use PostgreSQL FTS via raw query
  if (query && query.length >= 2) {
    return searchWithFTS(filters, page, limit);
  }

  // Build where clause for filters (no text search)
  const whereConditions: Prisma.PoliticianWhereInput[] = [];

  // Party filter
  if (partyId) {
    whereConditions.push({ currentPartyId: partyId });
  }

  // Mandate type filter
  if (mandateType) {
    whereConditions.push({
      mandates: {
        some: {
          type: mandateType,
          isCurrent: true,
        },
      },
    });
  }

  // Department filter
  if (department) {
    whereConditions.push({
      mandates: {
        some: {
          constituency: { startsWith: department, mode: "insensitive" },
          isCurrent: true,
        },
      },
    });
  }

  // Affairs filter
  if (hasAffairs === true) {
    whereConditions.push({
      affairs: { some: {} },
    });
  } else if (hasAffairs === false) {
    whereConditions.push({
      affairs: { none: {} },
    });
  }

  // Active status filter
  if (isActive === true) {
    whereConditions.push({
      mandates: { some: { isCurrent: true } },
    });
  } else if (isActive === false) {
    whereConditions.push({
      mandates: { none: { isCurrent: true } },
    });
  }

  const where: Prisma.PoliticianWhereInput =
    whereConditions.length > 0 ? { AND: whereConditions } : {};

  // Execute query
  const [politicians, total] = await Promise.all([
    db.politician.findMany({
      where,
      select: {
        id: true,
        slug: true,
        fullName: true,
        firstName: true,
        lastName: true,
        photoUrl: true,
        currentParty: {
          select: {
            id: true,
            shortName: true,
            color: true,
          },
        },
        mandates: {
          where: { isCurrent: true },
          select: {
            type: true,
            constituency: true,
          },
          take: 1,
        },
        _count: {
          select: { affairs: true },
        },
      },
      orderBy: [
        // Sort by last name for consistency
        { lastName: "asc" },
        { firstName: "asc" },
      ],
      skip,
      take: limit,
    }),
    db.politician.count({ where }),
  ]);

  // Transform results
  const results: SearchResult[] = politicians.map((p) => ({
    id: p.id,
    slug: p.slug,
    fullName: p.fullName,
    firstName: p.firstName,
    lastName: p.lastName,
    photoUrl: p.photoUrl,
    currentParty: p.currentParty,
    currentMandate: p.mandates[0] || null,
    affairsCount: p._count.affairs,
  }));

  // Generate suggestions if no results
  let suggestions: string[] | undefined;
  if (results.length === 0 && query && query.length >= 2) {
    suggestions = await generateSuggestions(query);
  }

  return {
    results,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    suggestions,
  };
}

/**
 * Generate search suggestions when no results found
 */
async function generateSuggestions(query: string): Promise<string[]> {
  // Find similar names using trigram similarity
  // For now, just return some common patterns
  const partialMatches = await db.politician.findMany({
    where: {
      OR: [
        { lastName: { startsWith: query.slice(0, 3), mode: "insensitive" } },
        { firstName: { startsWith: query.slice(0, 3), mode: "insensitive" } },
      ],
    },
    select: { fullName: true },
    take: 5,
    distinct: ["fullName"],
  });

  return partialMatches.map((p) => p.fullName);
}

/**
 * Get autocomplete suggestions using FTS for better performance
 */
export async function getAutocompleteSuggestions(
  query: string,
  limit: number = 8
): Promise<SearchResult[]> {
  if (query.length < 2) {
    return [];
  }

  // Use FTS for fast autocomplete
  const ftsResults = await db.$queryRaw<FTSResult[]>`
    SELECT
      p.id,
      p.slug,
      p."fullName",
      p."firstName",
      p."lastName",
      p."photoUrl",
      p."currentPartyId",
      ts_rank(p."searchVector", plainto_tsquery('french', unaccent(${query}))) as relevance
    FROM "Politician" p
    WHERE p."searchVector" @@ plainto_tsquery('french', unaccent(${query}))
       OR p."fullName" ILIKE ${`%${query}%`}
       OR p."lastName" ILIKE ${`%${query}%`}
    ORDER BY relevance DESC, p."lastName" ASC
    LIMIT ${limit}
  `;

  if (ftsResults.length === 0) {
    return [];
  }

  // Get full data with party info
  const ids = ftsResults.map((r) => r.id);
  const politicians = await db.politician.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      slug: true,
      fullName: true,
      firstName: true,
      lastName: true,
      photoUrl: true,
      currentParty: {
        select: { id: true, shortName: true, color: true },
      },
      mandates: {
        where: { isCurrent: true },
        select: { type: true, constituency: true },
        take: 1,
      },
      _count: { select: { affairs: true } },
    },
  });

  // Preserve FTS order
  const politicianMap = new Map(politicians.map((p) => [p.id, p]));
  return ids
    .map((id) => politicianMap.get(id))
    .filter(Boolean)
    .map((p) => ({
      id: p!.id,
      slug: p!.slug,
      fullName: p!.fullName,
      firstName: p!.firstName,
      lastName: p!.lastName,
      photoUrl: p!.photoUrl,
      currentParty: p!.currentParty,
      currentMandate: p!.mandates[0] || null,
      affairsCount: p!._count.affairs,
    }));
}

/**
 * Get search filter options (for dropdowns)
 */
export async function getSearchFilterOptions() {
  const [parties, departments, mandateTypes] = await Promise.all([
    // Get parties with active members
    db.party.findMany({
      where: {
        politicians: {
          some: {
            mandates: { some: { isCurrent: true } },
          },
        },
      },
      select: {
        id: true,
        shortName: true,
        name: true,
        color: true,
        _count: {
          select: { politicians: true },
        },
      },
      orderBy: { politicians: { _count: "desc" } },
    }),

    // Get unique departments
    db.mandate.findMany({
      where: {
        isCurrent: true,
        constituency: { not: null },
        type: "DEPUTE",
      },
      select: { constituency: true },
      distinct: ["constituency"],
    }),

    // Get mandate type counts (counting distinct politicians, not mandates)
    db.$queryRaw<Array<{ type: MandateType; count: bigint }>>`
      SELECT m.type, COUNT(DISTINCT m."politicianId") as count
      FROM "Mandate" m
      WHERE m."isCurrent" = true
      GROUP BY m.type
      ORDER BY count DESC
    `,
  ]);

  // Extract unique department names
  const uniqueDepartments = [
    ...new Set(departments.map((d) => d.constituency?.split("(")[0].trim()).filter(Boolean)),
  ].sort();

  return {
    parties: parties.map((p) => ({
      id: p.id,
      shortName: p.shortName,
      name: p.name,
      color: p.color,
      count: p._count.politicians,
    })),
    departments: uniqueDepartments,
    mandateTypes: mandateTypes.map((m) => ({
      type: m.type,
      count: Number(m.count),
    })),
  };
}
