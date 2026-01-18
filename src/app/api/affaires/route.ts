import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/affaires
 * Public API to list all documented affairs
 *
 * Query params:
 * - status: filter by status (e.g., CONDAMNATION_DEFINITIVE)
 * - category: filter by category (e.g., CORRUPTION)
 * - page: page number (default: 1)
 * - limit: items per page (default: 20, max: 100)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const status = searchParams.get("status");
  const category = searchParams.get("category");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const skip = (page - 1) * limit;

  const where = {
    ...(status && { status: status as any }),
    ...(category && { category: category as any }),
  };

  try {
    const [affairs, total] = await Promise.all([
      db.affair.findMany({
        where,
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          status: true,
          category: true,
          factsDate: true,
          startDate: true,
          verdictDate: true,
          sentence: true,
          appeal: true,
          createdAt: true,
          updatedAt: true,
          politician: {
            select: {
              id: true,
              slug: true,
              fullName: true,
              currentParty: {
                select: { shortName: true, name: true },
              },
            },
          },
          partyAtTime: {
            select: { shortName: true, name: true },
          },
          sources: {
            select: {
              id: true,
              url: true,
              title: true,
              publisher: true,
              publishedAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.affair.count({ where }),
    ]);

    return NextResponse.json({
      data: affairs,
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
