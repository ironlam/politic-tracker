import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const data = await request.json();

    const existing = await db.mandate.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Mandat non trouvé" }, { status: 404 });
    }

    const mandate = await db.mandate.update({
      where: { id },
      data: {
        officialUrl: data.officialUrl ?? undefined,
        sourceUrl: data.sourceUrl ?? undefined,
      },
    });

    await db.auditLog.create({
      data: {
        action: "UPDATE",
        entityType: "Mandate",
        entityId: mandate.id,
        changes: {
          officialUrl: mandate.officialUrl,
          sourceUrl: mandate.sourceUrl,
        },
      },
    });

    return NextResponse.json(mandate);
  } catch (error) {
    console.error("Error updating mandate:", error);
    return NextResponse.json({ error: "Erreur lors de la mise à jour" }, { status: 500 });
  }
}
