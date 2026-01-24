import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/votes
 * Public API to list parliamentary scrutins
 *
 * Query params:
 * - search: search in title
 * - result: filter by result (ADOPTED, REJECTED)
 * - legislature: filter by legislature number
 * - page: page number (default: 1)
 * - limit: items per page (default: 20, max: 100)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const search = searchParams.get("search");
  const result = searchParams.get("result");
  const legislature = searchParams.get("legislature");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const skip = (page - 1) * limit;

  const where = {
    ...(search && {
      title: { contains: search, mode: "insensitive" as const },
    }),
    ...(result && { result: result as "ADOPTED" | "REJECTED" }),
    ...(legislature && { legislature: parseInt(legislature, 10) }),
  };

  try {
    const [scrutins, total] = await Promise.all([
      db.scrutin.findMany({
        where,
        select: {
          id: true,
          externalId: true,
          title: true,
          votingDate: true,
          legislature: true,
          votesFor: true,
          votesAgainst: true,
          votesAbstain: true,
          result: true,
          sourceUrl: true,
          _count: {
            select: { votes: true },
          },
        },
        orderBy: { votingDate: "desc" },
        skip,
        take: limit,
      }),
      db.scrutin.count({ where }),
    ]);

    return NextResponse.json({
      data: scrutins.map((s) => ({
        ...s,
        totalVotes: s._count.votes,
        _count: undefined,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
