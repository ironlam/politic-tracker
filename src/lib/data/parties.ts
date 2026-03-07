import { cache } from "react";
import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import { CONVICTION_BADGE_WHERE, AFFAIR_STATUS_NEEDS_PRESUMPTION } from "@/config/labels";
import type { AffairStatus, PoliticalPosition } from "@/types";

export const getParty = cache(async function getParty(slug: string) {
  "use cache";
  cacheTag(`party:${slug}`, "parties");
  cacheLife("minutes");

  return db.party.findUnique({
    where: { slug },
    include: {
      // Current members
      politicians: {
        orderBy: { fullName: "asc" },
        include: {
          mandates: {
            where: { isCurrent: true },
            take: 1,
          },
          _count: {
            select: {
              affairs: { where: CONVICTION_BADGE_WHERE },
            },
          },
        },
      },
      // Membership history (for people who were members but aren't currently)
      partyMemberships: {
        include: {
          politician: true,
        },
        orderBy: { startDate: "desc" },
      },
      // Affairs that happened when politician was in this party
      affairsAtTime: {
        where: { publicationStatus: "PUBLISHED" },
        include: {
          politician: true,
        },
        orderBy: { verdictDate: "desc" },
      },
      // Party evolution
      predecessor: true,
      successors: true,
      // External IDs
      externalIds: true,
      // Press mentions
      pressMentions: {
        orderBy: { article: { publishedAt: "desc" } },
        take: 5,
        include: {
          article: {
            select: {
              id: true,
              title: true,
              url: true,
              feedSource: true,
              publishedAt: true,
            },
          },
        },
      },
    },
  });
});

export async function getPartyLeadership(partyId: string, partyName: string) {
  "use cache";
  cacheTag(`party-leadership:${partyId}`, "parties");
  cacheLife("minutes");

  return db.mandate.findMany({
    where: {
      type: "PRESIDENT_PARTI",
      OR: [
        { partyId },
        { institution: partyName, partyId: null }, // Fallback for non-migrated data
      ],
    },
    include: {
      politician: true,
    },
    orderBy: { startDate: "desc" },
  });
}

export async function getPartyRoles(partyId: string) {
  "use cache";
  cacheTag(`party-roles:${partyId}`, "parties");
  cacheLife("minutes");

  return db.partyMembership.findMany({
    where: {
      partyId,
      role: { not: "MEMBER" },
    },
    include: {
      politician: true,
    },
    orderBy: { startDate: "desc" },
  });
}

// ---------------------------------------------------------------------------
// Parties listing page — types & data functions
// ---------------------------------------------------------------------------

export type SortOption = "members" | "alpha" | "alpha-desc";
export type StatusFilter = "actifs" | "historiques" | "";

/** Tier 1: Core query — accepts free-text search (never cached directly). */
async function queryParties(
  search?: string,
  position?: PoliticalPosition,
  status?: StatusFilter,
  sort: SortOption = "members"
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [];

  if (search) {
    conditions.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { shortName: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  if (position) {
    conditions.push({ politicalPosition: position });
  }

  if (status === "actifs") {
    conditions.push({ dissolvedDate: null, politicians: { some: {} } });
  } else if (status === "historiques") {
    conditions.push({ dissolvedDate: { not: null } });
  }

  const where = conditions.length > 0 ? { AND: conditions } : {};

  const orderBy =
    sort === "alpha"
      ? [{ name: "asc" as const }]
      : sort === "alpha-desc"
        ? [{ name: "desc" as const }]
        : [{ politicians: { _count: "desc" as const } }, { name: "asc" as const }];

  const parties = await db.party.findMany({
    where,
    include: {
      _count: {
        select: {
          politicians: true,
          partyMemberships: true,
        },
      },
      affairsAtTime: {
        where: {
          publicationStatus: "PUBLISHED",
          involvement: { notIn: ["VICTIM", "PLAINTIFF"] },
        },
        select: { id: true, status: true },
      },
      predecessor: {
        select: { shortName: true, slug: true },
      },
    },
    orderBy,
  });

  return parties
    .filter((p) => p.slug)
    .map((party) => {
      const affairs = party.affairsAtTime;
      const condamnations = affairs.filter((a) => a.status === "CONDAMNATION_DEFINITIVE").length;
      const enCours = affairs.filter(
        (a) => AFFAIR_STATUS_NEEDS_PRESUMPTION[a.status as AffairStatus]
      ).length;
      const total = affairs.length;

      return {
        ...party,
        affairCounts: { condamnations, enCours, total },
        affairsAtTime: undefined,
      };
    });
}

/** Tier 2: Cached path — bounded params only (no free-text). */
async function getPartiesFiltered(
  position?: PoliticalPosition,
  status?: StatusFilter,
  sort: SortOption = "members"
) {
  "use cache";
  cacheTag("parties");
  cacheLife("minutes");
  return queryParties(undefined, position, status, sort);
}

/** Tier 3: Uncached path — free-text search. */
async function searchParties(
  search: string,
  position?: PoliticalPosition,
  status?: StatusFilter,
  sort: SortOption = "members"
) {
  return queryParties(search, position, status, sort);
}

/** Router — decides cached vs uncached. */
export async function getParties(
  search?: string,
  position?: PoliticalPosition,
  status?: StatusFilter,
  sort: SortOption = "members"
) {
  if (search) {
    return searchParties(search, position, status, sort);
  }
  return getPartiesFiltered(position, status, sort);
}

export async function getPartiesStats() {
  "use cache";
  cacheTag("parties");
  cacheLife("minutes");

  const [counts] = await db.$queryRaw<
    [{ actifs: bigint; gauche: bigint; centre: bigint; droite: bigint; affaires: bigint }]
  >`
    SELECT
      COUNT(*) FILTER (
        WHERE p."dissolvedDate" IS NULL
          AND EXISTS (SELECT 1 FROM "Politician" pol WHERE pol."currentPartyId" = p.id)
      ) AS actifs,
      COUNT(*) FILTER (
        WHERE p."politicalPosition" IN ('FAR_LEFT', 'LEFT', 'CENTER_LEFT')
          AND p."dissolvedDate" IS NULL
      ) AS gauche,
      COUNT(*) FILTER (
        WHERE p."politicalPosition" IN ('CENTER')
          AND p."dissolvedDate" IS NULL
      ) AS centre,
      COUNT(*) FILTER (
        WHERE p."politicalPosition" IN ('CENTER_RIGHT', 'RIGHT', 'FAR_RIGHT')
          AND p."dissolvedDate" IS NULL
      ) AS droite,
      COUNT(DISTINCT p.id) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM "Affair" a
          WHERE a."partyAtTimeId" = p.id
            AND a."publicationStatus" = 'PUBLISHED'
            AND a.involvement NOT IN ('VICTIM', 'PLAINTIFF')
        )
      ) AS affaires
    FROM "Party" p
    WHERE p.slug IS NOT NULL
  `;

  return {
    actifs: Number(counts.actifs),
    gauche: Number(counts.gauche),
    centre: Number(counts.centre),
    droite: Number(counts.droite),
    affaires: Number(counts.affaires),
  };
}
