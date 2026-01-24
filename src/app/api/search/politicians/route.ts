import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q") || "";

  if (query.length < 2) {
    return NextResponse.json([]);
  }

  const politicians = await db.politician.findMany({
    where: {
      OR: [
        { fullName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
        { firstName: { contains: query, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      fullName: true,
      slug: true,
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
        take: 1,
      },
    },
    orderBy: { lastName: "asc" },
    take: 8,
  });

  const results = politicians.map((p) => ({
    id: p.id,
    fullName: p.fullName,
    slug: p.slug,
    photoUrl: p.photoUrl,
    party: p.currentParty?.shortName || null,
    partyColor: p.currentParty?.color || null,
    mandate: p.mandates[0]?.type || null,
  }));

  return NextResponse.json(results);
}
