import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { findPotentialDuplicates, dismissDuplicate } from "@/services/affairs/reconciliation";

/**
 * GET /api/admin/affairs/duplicates
 *
 * Returns potential duplicate pairs.
 */
export async function GET() {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const duplicates = await findPotentialDuplicates();
    return NextResponse.json(duplicates);
  } catch (error) {
    console.error("Error finding duplicates:", error);
    return NextResponse.json({ error: "Erreur lors de la recherche de doublons" }, { status: 500 });
  }
}

/**
 * POST /api/admin/affairs/duplicates
 *
 * Dismiss a duplicate pair (mark as "not a duplicate").
 * Body: { affairIdA: string, affairIdB: string }
 */
export async function POST(request: NextRequest) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { affairIdA, affairIdB } = body as { affairIdA?: string; affairIdB?: string };

    if (!affairIdA || !affairIdB) {
      return NextResponse.json({ error: "affairIdA et affairIdB requis" }, { status: 400 });
    }

    await dismissDuplicate(affairIdA, affairIdB);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error dismissing duplicate:", error);
    return NextResponse.json({ error: "Erreur lors du dismiss" }, { status: 500 });
  }
}
