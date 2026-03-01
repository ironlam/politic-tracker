import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { enrichAffairSchema } from "@/lib/validations/affairs";
import { enrichAffair } from "@/services/affair-enrichment";

// ─── POST: enrich a single affair via web search ────────────────

export const POST = withAdminAuth(async (request: NextRequest) => {
  const body = await request.json();

  const parsed = enrichAffairSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { affairId } = parsed.data;
  const result = await enrichAffair(affairId);

  return NextResponse.json(result);
});
