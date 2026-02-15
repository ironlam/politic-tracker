import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { invalidateEntity } from "@/lib/cache";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/affairs/:id/reject
 *
 * Reject and delete an unverified affair.
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
      select: { id: true, title: true, politician: { select: { slug: true } } },
    });

    if (!affair) {
      return NextResponse.json({ error: "Affaire non trouvée" }, { status: 404 });
    }

    await db.affair.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        action: "REJECT",
        entityType: "Affair",
        entityId: id,
        changes: { title: affair.title },
      },
    });

    invalidateEntity("affair");
    if (affair.politician?.slug) invalidateEntity("politician", affair.politician.slug);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error rejecting affair:", error);
    return NextResponse.json({ error: "Erreur lors du rejet" }, { status: 500 });
  }
}
