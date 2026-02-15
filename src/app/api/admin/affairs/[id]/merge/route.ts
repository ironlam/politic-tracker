import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { invalidateEntity } from "@/lib/cache";
import { mergeAffairs } from "@/services/affairs/reconciliation";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/affairs/:id/merge
 *
 * Merge this affair into another one.
 * Body: { mergeIntoId: string }
 *
 * The current affair (id) is removed, its data transferred to mergeIntoId.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const { mergeIntoId } = body as { mergeIntoId?: string };

    if (!mergeIntoId) {
      return NextResponse.json({ error: "mergeIntoId requis" }, { status: 400 });
    }

    if (mergeIntoId === id) {
      return NextResponse.json(
        { error: "Impossible de fusionner une affaire avec elle-même" },
        { status: 400 }
      );
    }

    await mergeAffairs(mergeIntoId, id);

    invalidateEntity("affair");

    return NextResponse.json({ success: true, keptId: mergeIntoId });
  } catch (error) {
    console.error("Error merging affairs:", error);
    const message = error instanceof Error ? error.message : "Erreur lors de la fusion";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
