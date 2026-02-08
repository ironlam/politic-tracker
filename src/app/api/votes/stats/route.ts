import { NextRequest, NextResponse } from "next/server";
import { Chamber } from "@/generated/prisma";
import { voteStatsService } from "@/services/voteStats";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const chamber = searchParams.get("chamber") as Chamber | null;
  const limit = parseInt(searchParams.get("limit") || "20");

  try {
    const stats = await voteStatsService.getVoteStats(
      chamber || undefined,
      { partyLimit: limit, divisiveLimit: limit }
    );

    return NextResponse.json({
      parties: stats.parties,
      divisiveScrutins: stats.divisiveScrutins,
      global: {
        ...stats.global,
        totalVotes:
          stats.global.totalVotesFor +
          stats.global.totalVotesAgainst +
          stats.global.totalVotesAbstain,
      },
    });
  } catch (error) {
    console.error("Error fetching vote stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch vote stats" },
      { status: 500 }
    );
  }
}
