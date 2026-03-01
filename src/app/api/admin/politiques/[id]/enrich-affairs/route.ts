import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { db } from "@/lib/db";
import { enrichAffair } from "@/services/affair-enrichment";
import { BRAVE_SEARCH_RATE_LIMIT_MS } from "@/config/rate-limits";

// ─── POST: enrich all affairs of a politician ────────────────

export const POST = withAdminAuth(async (_request: NextRequest, context) => {
  const { id } = await context.params;

  const politician = await db.politician.findUnique({
    where: { id },
    select: {
      fullName: true,
      affairs: {
        select: {
          id: true,
          title: true,
          sources: { select: { id: true } },
        },
      },
    },
  });

  if (!politician) {
    return NextResponse.json({ error: "Politicien non trouvé" }, { status: 404 });
  }

  // Enrich affairs that look thin: few sources or title starts with "[À VÉRIFIER]"
  const candidates = politician.affairs.filter(
    (a) => a.sources.length <= 2 || a.title.startsWith("[À VÉRIFIER]")
  );

  if (candidates.length === 0) {
    return NextResponse.json({
      politician: politician.fullName,
      total: politician.affairs.length,
      enriched: 0,
      results: [],
      message: "Aucune affaire à enrichir (toutes ont déjà suffisamment de sources)",
    });
  }

  const results = [];
  for (let i = 0; i < candidates.length; i++) {
    const affair = candidates[i];
    try {
      const result = await enrichAffair(affair!.id);
      results.push({
        title: affair!.title,
        ...result,
      });
    } catch (error) {
      results.push({
        affairId: affair!.id,
        title: affair!.title,
        enriched: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    // Rate limit between Brave Search calls
    if (i < candidates.length - 1) {
      await new Promise((r) => setTimeout(r, BRAVE_SEARCH_RATE_LIMIT_MS));
    }
  }

  const enrichedCount = results.filter((r) => r.enriched).length;

  return NextResponse.json({
    politician: politician.fullName,
    total: politician.affairs.length,
    candidates: candidates.length,
    enriched: enrichedCount,
    results,
  });
});
