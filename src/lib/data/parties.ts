import { cache } from "react";
import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";

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
              affairs: {
                where: {
                  publicationStatus: "PUBLISHED",
                  involvement: { notIn: ["VICTIM", "PLAINTIFF"] },
                  status: "CONDAMNATION_DEFINITIVE",
                },
              },
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
