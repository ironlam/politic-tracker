import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withCache } from "@/lib/cache";

const LIMIT = 8;

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") || "";

  if (query.length < 2) {
    return NextResponse.json({
      politicians: [],
      parties: [],
      affairs: [],
      scrutins: [],
    });
  }

  const [politicians, parties, affairs, scrutins] = await Promise.all([
    // Politicians: ILIKE on fullName/lastName/firstName
    db.politician.findMany({
      where: {
        publicationStatus: "PUBLISHED",
        OR: [
          { fullName: { contains: query, mode: "insensitive" } },
          { lastName: { startsWith: query, mode: "insensitive" } },
          { firstName: { startsWith: query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        slug: true,
        fullName: true,
        photoUrl: true,
        currentParty: {
          select: { shortName: true, color: true },
        },
        mandates: {
          where: { isCurrent: true },
          select: { type: true },
          take: 1,
        },
      },
      orderBy: [{ prominenceScore: "desc" }, { lastName: "asc" }],
      take: LIMIT,
    }),

    // Parties: ILIKE on name/shortName
    db.party.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { shortName: { equals: query, mode: "insensitive" } },
        ],
      },
      select: {
        slug: true,
        name: true,
        shortName: true,
        color: true,
        _count: { select: { politicians: true } },
      },
      orderBy: { name: "asc" },
      take: LIMIT,
    }),

    // Affairs: ILIKE on title
    db.affair.findMany({
      where: {
        publicationStatus: "PUBLISHED",
        title: { contains: query, mode: "insensitive" },
      },
      select: {
        slug: true,
        title: true,
        status: true,
        politician: {
          select: { fullName: true, slug: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
    }),

    // Scrutins: ILIKE on title
    db.scrutin.findMany({
      where: {
        title: { contains: query, mode: "insensitive" },
      },
      select: {
        id: true,
        slug: true,
        title: true,
        votingDate: true,
        chamber: true,
      },
      orderBy: { votingDate: "desc" },
      take: LIMIT,
    }),
  ]);

  return withCache(
    NextResponse.json({
      politicians: politicians.map((p) => ({
        id: p.id,
        slug: p.slug,
        fullName: p.fullName,
        photoUrl: p.photoUrl,
        party: p.currentParty?.shortName || null,
        partyColor: p.currentParty?.color || null,
        mandate: p.mandates[0]?.type || null,
      })),
      parties: parties.map((p) => ({
        slug: p.slug,
        name: p.name,
        shortName: p.shortName,
        color: p.color,
        memberCount: p._count.politicians,
      })),
      affairs: affairs.map((a) => ({
        slug: a.slug,
        title: a.title,
        status: a.status,
        politicianName: a.politician.fullName,
        politicianSlug: a.politician.slug,
      })),
      scrutins: scrutins.map((s) => ({
        slug: s.slug,
        id: s.id,
        title: s.title,
        votingDate: s.votingDate.toISOString(),
        chamber: s.chamber,
      })),
    }),
    "daily"
  );
}
