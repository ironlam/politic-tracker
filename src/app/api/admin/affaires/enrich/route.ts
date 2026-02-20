import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { enrichAffairSchema } from "@/lib/validations/affairs";
import { enrichAffair } from "@/services/affair-enrichment";

// ─── POST: enrich a single affair via web search ────────────────

export async function POST(request: NextRequest) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const parsed = enrichAffairSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { affairId } = parsed.data;
    const result = await enrichAffair(affairId);

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/admin/affaires/enrich error:", error);
    return NextResponse.json({ error: "Erreur lors de l'enrichissement" }, { status: 500 });
  }
}
