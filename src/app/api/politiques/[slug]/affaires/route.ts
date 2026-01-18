import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/politiques/[slug]/affaires
 * Public API to get affairs for a specific politician
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;

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
        affairs: {
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
        },
      },
    });

    if (!politician) {
      return NextResponse.json(
        { error: "Politique non trouvé" },
        { status: 404 }
      );
    }

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
      affairs: politician.affairs,
      total: politician.affairs.length,
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
