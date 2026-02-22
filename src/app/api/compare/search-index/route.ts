import { NextResponse } from "next/server";
import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";

/**
 * Lightweight search index for client-side autocomplete in the compare page.
 * Returns all published politicians and active parties with minimal fields.
 */

async function getSearchIndex() {
  "use cache";
  cacheTag("politicians", "parties");
  cacheLife("hours");

  const [politicians, parties] = await Promise.all([
    db.politician.findMany({
      where: {
        publicationStatus: "PUBLISHED",
      },
      select: {
        slug: true,
        fullName: true,
        photoUrl: true,
        currentParty: {
          select: {
            shortName: true,
            color: true,
          },
        },
        mandates: {
          where: { isCurrent: true },
          select: { type: true },
          orderBy: { startDate: "desc" },
          take: 1,
        },
      },
      orderBy: [{ prominenceScore: "desc" }, { lastName: "asc" }],
    }),
    db.party.findMany({
      where: {
        dissolvedDate: null,
        politicians: {
          some: {},
        },
      },
      select: {
        slug: true,
        name: true,
        shortName: true,
        color: true,
        logoUrl: true,
        _count: {
          select: { politicians: true },
        },
      },
      orderBy: [{ name: "asc" }],
    }),
  ]);

  // Map politicians to a flat shape
  const politicianIndex = politicians.map((p) => ({
    slug: p.slug,
    fullName: p.fullName,
    photoUrl: p.photoUrl,
    partyShortName: p.currentParty?.shortName ?? null,
    partyColor: p.currentParty?.color ?? null,
    mandateType: p.mandates[0]?.type ?? null,
  }));

  // Map parties to a flat shape, sorted by member count desc then name asc
  const partyIndex = parties
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      shortName: p.shortName,
      color: p.color,
      logoUrl: p.logoUrl,
      memberCount: p._count.politicians,
    }))
    .sort((a, b) => b.memberCount - a.memberCount || a.name.localeCompare(b.name));

  return { politicians: politicianIndex, parties: partyIndex };
}

export async function GET() {
  const data = await getSearchIndex();
  return NextResponse.json(data);
}
