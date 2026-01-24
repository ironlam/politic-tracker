import { db } from "@/lib/db";
import { Prisma, MandateType } from "@/generated/prisma";

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
 * Advanced search using PostgreSQL full-text search when available,
 * with fallback to ILIKE for basic substring matching
 */
export async function searchPoliticians(
  filters: SearchFilters,
  page: number = 1,
  limit: number = 20
): Promise<SearchResponse> {
  const { query, partyId, mandateType, department, hasAffairs, isActive } = filters;
  const skip = (page - 1) * limit;

  // Build where clause for filters
  const whereConditions: Prisma.PoliticianWhereInput[] = [];

  // Text search - use ILIKE for now (FTS requires manual migration)
  if (query && query.length >= 2) {
    whereConditions.push({
      OR: [
        { fullName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
        { firstName: { contains: query, mode: "insensitive" } },
        { slug: { contains: query.toLowerCase().replace(/\s+/g, "-") } },
      ],
    });
  }

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
 * Get autocomplete suggestions
 */
export async function getAutocompleteSuggestions(
  query: string,
  limit: number = 8
): Promise<SearchResult[]> {
  if (query.length < 2) {
    return [];
  }

  const politicians = await db.politician.findMany({
    where: {
      OR: [
        { fullName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
        { firstName: { contains: query, mode: "insensitive" } },
      ],
    },
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
    orderBy: { lastName: "asc" },
    take: limit,
  });

  return politicians.map((p) => ({
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

    // Get mandate type counts
    db.mandate.groupBy({
      by: ["type"],
      where: { isCurrent: true },
      _count: true,
    }),
  ]);

  // Extract unique department names
  const uniqueDepartments = [
    ...new Set(
      departments
        .map((d) => d.constituency?.split("(")[0].trim())
        .filter(Boolean)
    ),
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
      count: m._count,
    })),
  };
}
