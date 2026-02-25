import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withCache } from "@/lib/cache";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") || "";

  if (query.length < 2) {
    return NextResponse.json({
      politicians: [],
      parties: [],
      scrutins: [],
      dossiers: [],
    });
  }

  const [politicians, parties, scrutins] = await Promise.all([
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
      take: 5,
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
      take: 5,
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
      take: 5,
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
      scrutins: scrutins.map((s) => ({
        slug: s.slug,
        id: s.id,
        title: s.title,
        votingDate: s.votingDate.toISOString(),
        chamber: s.chamber,
      })),
      // Dossiers: disabled until a public page exists (see #118)
      dossiers: [],
    }),
    "daily"
  );
}
