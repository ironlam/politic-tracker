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
