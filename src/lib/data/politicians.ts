import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";

export async function getPolitician(slug: string) {
  "use cache";
  cacheTag(`politician:${slug}`, "politicians");
  cacheLife("minutes");

  const politician = await db.politician.findUnique({
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
        where: { publicationStatus: "PUBLISHED" },
        include: {
          sources: true,
          partyAtTime: true,
          events: {
            orderBy: { date: "asc" },
          },
        },
        orderBy: { verdictDate: "desc" },
      },
      declarations: {
        orderBy: { year: "desc" },
      },
      factCheckMentions: {
        include: {
          factCheck: {
            select: {
              id: true,
              slug: true,
              title: true,
              claimText: true,
              claimant: true,
              verdictRating: true,
              source: true,
              sourceUrl: true,
              publishedAt: true,
            },
          },
        },
        orderBy: { factCheck: { publishedAt: "desc" } },
        take: 20,
      },
      partyHistory: {
        include: {
          party: {
            select: { name: true, shortName: true, slug: true, color: true },
          },
        },
        orderBy: { startDate: "desc" },
      },
      externalIds: {
        select: { url: true, source: true },
      },
    },
  });

  if (!politician) return null;

  // Serialize Decimal fields to numbers for client components
  return {
    ...politician,
    affairs: politician.affairs.map((affair) => ({
      ...affair,
      fineAmount: affair.fineAmount ? Number(affair.fineAmount) : null,
    })),
    mandates: politician.mandates.map((mandate) => ({
      ...mandate,
      baseSalary: mandate.baseSalary ? Number(mandate.baseSalary) : null,
      totalAllowances: mandate.totalAllowances ? Number(mandate.totalAllowances) : null,
    })),
  };
}
