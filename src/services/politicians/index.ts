import { db } from "@/lib/db";
import type {
  PoliticianFilters,
  PaginatedResponse,
  PoliticianWithParty,
  PoliticianFull,
} from "@/types";

const DEFAULT_LIMIT = 20;

export async function getPoliticians(
  filters: PoliticianFilters = {}
): Promise<PaginatedResponse<PoliticianWithParty>> {
  const {
    search,
    partyId,
    mandateType,
    hasAffairs,
    publicationStatus = "PUBLISHED",
    page = 1,
    limit = DEFAULT_LIMIT,
    sortBy = "name",
  } = filters;

  const where = {
    publicationStatus,
    ...(search && {
      OR: [
        { fullName: { contains: search, mode: "insensitive" as const } },
        { lastName: { contains: search, mode: "insensitive" as const } },
      ],
    }),
    ...(partyId && { currentPartyId: partyId }),
    ...(mandateType && {
      mandates: {
        some: {
          type: mandateType,
          isCurrent: true,
        },
      },
    }),
    ...(hasAffairs !== undefined && {
      affairs: hasAffairs ? { some: {} } : { none: {} },
    }),
  };

  const orderBy =
    sortBy === "prominence"
      ? [{ prominenceScore: "desc" as const }, { lastName: "asc" as const }]
      : { lastName: "asc" as const };

  const [data, total] = await Promise.all([
    db.politician.findMany({
      where,
      include: {
        currentParty: true,
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.politician.count({ where }),
  ]);

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getPoliticianBySlug(slug: string): Promise<PoliticianFull | null> {
  return db.politician.findUnique({
    where: { slug },
    include: {
      currentParty: true,
      mandates: {
        orderBy: { startDate: "desc" },
        include: {
          parliamentaryGroup: {
            select: { code: true, name: true, color: true },
          },
        },
      },
      affairs: {
        include: {
          sources: true,
        },
        orderBy: { createdAt: "desc" },
      },
      declarations: {
        orderBy: { year: "desc" },
      },
      _count: {
        select: { factCheckMentions: true },
      },
    },
  });
}

export async function getPoliticianById(id: string): Promise<PoliticianFull | null> {
  return db.politician.findUnique({
    where: { id },
    include: {
      currentParty: true,
      mandates: {
        orderBy: { startDate: "desc" },
      },
      affairs: {
        include: {
          sources: true,
        },
        orderBy: { createdAt: "desc" },
      },
      declarations: {
        orderBy: { year: "desc" },
      },
    },
  });
}

export async function searchPoliticians(query: string, limit = 10): Promise<PoliticianWithParty[]> {
  return db.politician.findMany({
    where: {
      publicationStatus: "PUBLISHED",
      OR: [
        { fullName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
        { firstName: { contains: query, mode: "insensitive" } },
      ],
    },
    include: {
      currentParty: true,
    },
    orderBy: [{ prominenceScore: "desc" }, { lastName: "asc" }],
    take: limit,
  });
}

export async function getPartiesWithCount() {
  return db.party.findMany({
    include: {
      _count: {
        select: { politicians: true },
      },
    },
    orderBy: { name: "asc" },
  });
}
