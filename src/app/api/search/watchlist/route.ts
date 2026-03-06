import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withPublicRoute } from "@/lib/api/with-public-route";
import { withCache } from "@/lib/cache";

export const GET = withPublicRoute(async (request: NextRequest) => {
  const q = request.nextUrl.searchParams.get("q")?.trim();

  if (!q || q.length < 2 || q.length > 100) {
    return NextResponse.json({ politicians: [], parties: [] });
  }

  const [politicians, parties] = await Promise.all([
    db.politician.findMany({
      where: {
        publicationStatus: "PUBLISHED",
        OR: [
          { fullName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { firstName: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        slug: true,
        fullName: true,
        photoUrl: true,
        currentParty: { select: { shortName: true } },
        mandates: {
          where: { isCurrent: true },
          select: { type: true },
          take: 1,
        },
      },
      orderBy: { prominenceScore: "desc" },
      take: 5,
    }),
    db.party.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { shortName: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        slug: true,
        name: true,
        shortName: true,
        color: true,
        _count: {
          select: { partyMemberships: { where: { endDate: null } } },
        },
      },
      orderBy: { name: "asc" },
      take: 3,
    }),
  ]);

  const response = NextResponse.json({
    politicians: politicians.map((p) => ({
      slug: p.slug,
      fullName: p.fullName,
      photoUrl: p.photoUrl,
      party: p.currentParty?.shortName || null,
      mandate: p.mandates[0]?.type || null,
    })),
    parties: parties.map((p) => ({
      slug: p.slug,
      name: p.name,
      shortName: p.shortName,
      color: p.color,
      memberCount: p._count.partyMemberships,
    })),
  });

  return withCache(response, "daily");
});
