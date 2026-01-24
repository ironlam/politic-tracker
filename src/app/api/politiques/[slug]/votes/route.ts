import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/politiques/[slug]/votes
 * Public API to get voting record for a specific politician
 *
 * Query params:
 * - page: page number (default: 1)
 * - limit: items per page (default: 20, max: 100)
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const skip = (page - 1) * limit;

  try {
    const politician = await db.politician.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        fullName: true,
        firstName: true,
        lastName: true,
        photoUrl: true,
        currentParty: {
          select: { shortName: true, name: true, color: true },
        },
      },
    });

    if (!politician) {
      return NextResponse.json(
        { error: "Politique non trouvé" },
        { status: 404 }
      );
    }

    // Get votes with scrutin info
    const [votes, total, stats] = await Promise.all([
      db.vote.findMany({
        where: { politicianId: politician.id },
        include: {
          scrutin: {
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
            },
          },
        },
        orderBy: { scrutin: { votingDate: "desc" } },
        skip,
        take: limit,
      }),
      db.vote.count({
        where: { politicianId: politician.id },
      }),
      // Calculate stats
      db.vote.groupBy({
        by: ["position"],
        where: { politicianId: politician.id },
        _count: true,
      }),
    ]);

    // Build stats object
    const votingStats = {
      total: 0,
      pour: 0,
      contre: 0,
      abstention: 0,
      absent: 0,
      participationRate: 0,
    };

    for (const s of stats) {
      votingStats.total += s._count;
      switch (s.position) {
        case "POUR":
          votingStats.pour = s._count;
          break;
        case "CONTRE":
          votingStats.contre = s._count;
          break;
        case "ABSTENTION":
          votingStats.abstention = s._count;
          break;
        case "ABSENT":
          votingStats.absent = s._count;
          break;
      }
    }

    // Participation = votes expressed / total (excluding absents)
    const expressed = votingStats.pour + votingStats.contre + votingStats.abstention;
    votingStats.participationRate = votingStats.total > 0
      ? Math.round((expressed / votingStats.total) * 100)
      : 0;

    return NextResponse.json({
      politician: {
        id: politician.id,
        slug: politician.slug,
        fullName: politician.fullName,
        firstName: politician.firstName,
        lastName: politician.lastName,
        photoUrl: politician.photoUrl,
        party: politician.currentParty,
      },
      stats: votingStats,
      votes: votes.map((v) => ({
        id: v.id,
        position: v.position,
        scrutin: v.scrutin,
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
