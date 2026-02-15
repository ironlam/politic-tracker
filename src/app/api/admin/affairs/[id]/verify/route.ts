import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { invalidateEntity } from "@/lib/cache";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/affairs/:id/verify
 *
 * Mark an affair as verified: sets verifiedAt, removes [À VÉRIFIER] prefix.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const affair = await db.affair.findUnique({
      where: { id },
      select: { id: true, title: true, politicianId: true },
    });

    if (!affair) {
      return NextResponse.json({ error: "Affaire non trouvée" }, { status: 404 });
    }

    // Remove [À VÉRIFIER] prefix if present
    const cleanTitle = affair.title.replace(/^\[À VÉRIFIER\]\s*/i, "");

    await db.affair.update({
      where: { id },
      data: {
        verifiedAt: new Date(),
        verifiedBy: "admin",
        title: cleanTitle,
      },
    });

    await db.auditLog.create({
      data: {
        action: "VERIFY",
        entityType: "Affair",
        entityId: id,
        changes: { title: cleanTitle },
      },
    });

    invalidateEntity("affair");

    return NextResponse.json({ success: true, title: cleanTitle });
  } catch (error) {
    console.error("Error verifying affair:", error);
    return NextResponse.json({ error: "Erreur lors de la vérification" }, { status: 500 });
  }
}
