/**
 * Prisma query helpers to reduce code duplication
 */

/**
 * Build a search WHERE clause for politician name fields
 */
export function buildPoliticianSearchWhere(search: string) {
  return {
    OR: [
      { fullName: { contains: search, mode: "insensitive" as const } },
      { lastName: { contains: search, mode: "insensitive" as const } },
      { firstName: { contains: search, mode: "insensitive" as const } },
    ],
  };
}

/**
 * Build a generic search WHERE clause for multiple fields
 */
export function buildSearchWhere(search: string, fields: string[]) {
  return {
    OR: fields.map((field) => ({
      [field]: { contains: search, mode: "insensitive" as const },
    })),
  };
}

/**
 * Calculate total pages for pagination
 */
export function calculateTotalPages(total: number, limit: number): number {
  return Math.ceil(total / limit);
}

/**
 * Standard include for politician with current party
 */
export const POLITICIAN_WITH_PARTY_INCLUDE = {
  currentParty: true,
} as const;

/**
 * Standard include for affair with politician and sources
 */
export const AFFAIR_WITH_POLITICIAN_INCLUDE = {
  politician: {
    include: {
      currentParty: true,
    },
  },
  sources: true,
} as const;

/**
 * Standard include for politician with all relations
 */
export const POLITICIAN_FULL_INCLUDE = {
  currentParty: true,
  mandates: {
    orderBy: { startDate: "desc" as const },
  },
  affairs: {
    include: {
      sources: true,
    },
    orderBy: { startDate: "desc" as const },
  },
  declarations: {
    orderBy: { filingDate: "desc" as const },
  },
} as const;

// ============================================================================
// Sync Helpers
// ============================================================================

import { db } from "./db";
import { DataSource } from "../generated/prisma";

/**
 * Build a map of external IDs to politician IDs for fast lookup
 */
export async function buildExternalIdMap(
  source: DataSource
): Promise<Map<string, string>> {
  const externalIds = await db.externalId.findMany({
    where: {
      source,
      politicianId: { not: null },
    },
    select: {
      externalId: true,
      politicianId: true,
    },
  });

  const map = new Map<string, string>();
  for (const ext of externalIds) {
    if (ext.politicianId) {
      map.set(ext.externalId, ext.politicianId);
    }
  }

  return map;
}

/**
 * Build a map of external IDs to party IDs for fast lookup
 */
export async function buildPartyExternalIdMap(
  source: DataSource
): Promise<Map<string, string>> {
  const externalIds = await db.externalId.findMany({
    where: {
      source,
      partyId: { not: null },
    },
    select: {
      externalId: true,
      partyId: true,
    },
  });

  const map = new Map<string, string>();
  for (const ext of externalIds) {
    if (ext.partyId) {
      map.set(ext.externalId, ext.partyId);
    }
  }

  return map;
}

/**
 * Upsert an external ID for a politician
 */
export async function upsertPoliticianExternalId(
  politicianId: string,
  source: DataSource,
  externalId: string,
  url?: string
): Promise<void> {
  await db.externalId.upsert({
    where: {
      source_externalId: {
        source,
        externalId,
      },
    },
    create: {
      politicianId,
      source,
      externalId,
      url,
    },
    update: {
      politicianId,
      url,
    },
  });
}

/**
 * Upsert an external ID for a party
 */
export async function upsertPartyExternalId(
  partyId: string,
  source: DataSource,
  externalId: string,
  url?: string
): Promise<void> {
  await db.externalId.upsert({
    where: {
      source_externalId: {
        source,
        externalId,
      },
    },
    create: {
      partyId,
      source,
      externalId,
      url,
    },
    update: {
      partyId,
      url,
    },
  });
}

/**
 * Find a politician by external ID
 */
export async function findPoliticianByExternalId(
  source: DataSource,
  externalId: string
): Promise<string | null> {
  const ext = await db.externalId.findUnique({
    where: {
      source_externalId: {
        source,
        externalId,
      },
    },
    select: {
      politicianId: true,
    },
  });

  return ext?.politicianId ?? null;
}

/**
 * Get politicians missing a specific external ID source
 */
export async function getPoliticiansMissingSource(
  source: DataSource,
  options: { limit?: number; onlyWithWikidata?: boolean } = {}
): Promise<Array<{ id: string; fullName: string; wikidataId?: string }>> {
  const { limit, onlyWithWikidata = false } = options;

  const where: Parameters<typeof db.politician.findMany>[0]["where"] = {
    externalIds: {
      none: { source },
    },
  };

  if (onlyWithWikidata) {
    where.externalIds = {
      ...where.externalIds,
      some: { source: DataSource.WIKIDATA },
    };
  }

  const politicians = await db.politician.findMany({
    where,
    select: {
      id: true,
      fullName: true,
      externalIds: {
        where: { source: DataSource.WIKIDATA },
        select: { externalId: true },
        take: 1,
      },
    },
    orderBy: { lastName: "asc" },
    take: limit,
  });

  return politicians.map((p) => ({
    id: p.id,
    fullName: p.fullName,
    wikidataId: p.externalIds[0]?.externalId,
  }));
}
