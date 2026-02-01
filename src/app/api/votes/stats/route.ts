import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Chamber } from "@/generated/prisma";

export const dynamic = "force-dynamic";

interface PartyVoteStats {
  partyId: string;
  partyName: string;
  partyShortName: string;
  partyColor: string | null;
  totalVotes: number;
  pour: number;
  contre: number;
  abstention: number;
  absent: number;
  // Cohesion: how often party members vote the same way
  cohesionRate: number;
  participationRate: number;
}

interface DivisiveScrutin {
  id: string;
  slug: string | null;
  title: string;
  votingDate: Date;
  chamber: Chamber;
  // Division score: how split the votes are (0 = unanimous, 100 = perfectly split)
  divisionScore: number;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const chamber = searchParams.get("chamber") as Chamber | null;
  const limit = parseInt(searchParams.get("limit") || "20");

  try {
    // Build chamber filter
    const chamberFilter = chamber ? { chamber } : {};

    // Get all parties with their vote counts
    const partyStats = await db.$queryRaw<
      {
        partyId: string;
        partyName: string;
        partyShortName: string;
        partyColor: string | null;
        position: string;
        count: bigint;
      }[]
    >`
      SELECT
        p.id as "partyId",
        p.name as "partyName",
        p."shortName" as "partyShortName",
        p.color as "partyColor",
        v.position,
        COUNT(v.id) as count
      FROM "Vote" v
      JOIN "Politician" pol ON v."politicianId" = pol.id
      JOIN "Party" p ON pol."currentPartyId" = p.id
      JOIN "Scrutin" s ON v."scrutinId" = s.id
      ${chamber ? db.$queryRaw`WHERE s.chamber = ${chamber}::"Chamber"` : db.$queryRaw``}
      GROUP BY p.id, p.name, p."shortName", p.color, v.position
      ORDER BY p."shortName", v.position
    `;

    // Aggregate party stats
    const partyMap = new Map<string, PartyVoteStats>();

    for (const row of partyStats) {
      if (!partyMap.has(row.partyId)) {
        partyMap.set(row.partyId, {
          partyId: row.partyId,
          partyName: row.partyName,
          partyShortName: row.partyShortName,
          partyColor: row.partyColor,
          totalVotes: 0,
          pour: 0,
          contre: 0,
          abstention: 0,
          absent: 0,
          cohesionRate: 0,
          participationRate: 0,
        });
      }

      const stats = partyMap.get(row.partyId)!;
      const count = Number(row.count);
      stats.totalVotes += count;

      switch (row.position) {
        case "POUR":
          stats.pour = count;
          break;
        case "CONTRE":
          stats.contre = count;
          break;
        case "ABSTENTION":
          stats.abstention = count;
          break;
        case "ABSENT":
          stats.absent = count;
          break;
      }
    }

    // Calculate cohesion and participation rates
    for (const stats of partyMap.values()) {
      const participating = stats.pour + stats.contre + stats.abstention;
      stats.participationRate =
        stats.totalVotes > 0 ? Math.round((participating / stats.totalVotes) * 100) : 0;

      // Cohesion: % of votes that match the majority position
      const maxPosition = Math.max(stats.pour, stats.contre, stats.abstention);
      stats.cohesionRate =
        participating > 0 ? Math.round((maxPosition / participating) * 100) : 0;
    }

    // Sort by total votes and filter small parties
    const parties = Array.from(partyMap.values())
      .filter((p) => p.totalVotes >= 100) // Minimum 100 votes to be included
      .sort((a, b) => b.totalVotes - a.totalVotes)
      .slice(0, limit);

    // Get most divisive scrutins
    // Division score = 100 - |pour - contre| / (pour + contre) * 100
    // Higher score = more divisive
    const divisiveScrutins = await db.$queryRaw<
      {
        id: string;
        slug: string | null;
        title: string;
        votingDate: Date;
        chamber: Chamber;
        votesFor: number;
        votesAgainst: number;
        votesAbstain: number;
      }[]
    >`
      SELECT
        s.id,
        s.slug,
        s.title,
        s."votingDate",
        s.chamber,
        s."votesFor",
        s."votesAgainst",
        s."votesAbstain"
      FROM "Scrutin" s
      WHERE s."votesFor" > 0 AND s."votesAgainst" > 0
      ${chamber ? db.$queryRaw`AND s.chamber = ${chamber}::"Chamber"` : db.$queryRaw``}
      ORDER BY
        ABS(s."votesFor" - s."votesAgainst")::float / NULLIF(s."votesFor" + s."votesAgainst", 0) ASC,
        s."votingDate" DESC
      LIMIT ${limit}
    `;

    const divisive: DivisiveScrutin[] = divisiveScrutins.map((s) => ({
      ...s,
      divisionScore: Math.round(
        100 - (Math.abs(s.votesFor - s.votesAgainst) / (s.votesFor + s.votesAgainst)) * 100
      ),
    }));

    // Get global stats
    const globalStats = await db.scrutin.aggregate({
      where: chamberFilter,
      _count: true,
      _sum: {
        votesFor: true,
        votesAgainst: true,
        votesAbstain: true,
      },
    });

    const totalScrutins = globalStats._count;
    const totalVotesFor = globalStats._sum.votesFor || 0;
    const totalVotesAgainst = globalStats._sum.votesAgainst || 0;
    const totalVotesAbstain = globalStats._sum.votesAbstain || 0;

    return NextResponse.json({
      parties,
      divisiveScrutins: divisive,
      global: {
        totalScrutins,
        totalVotesFor,
        totalVotesAgainst,
        totalVotesAbstain,
        totalVotes: totalVotesFor + totalVotesAgainst + totalVotesAbstain,
      },
    });
  } catch (error) {
    console.error("Error fetching vote stats:", error);
    return NextResponse.json({ error: "Failed to fetch vote stats" }, { status: 500 });
  }
}
