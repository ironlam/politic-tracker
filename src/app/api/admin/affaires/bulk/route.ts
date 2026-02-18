import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { invalidateEntity } from "@/lib/cache";
import { bulkAffairActionSchema } from "@/lib/validations/affairs";

export async function POST(request: NextRequest) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const parsed = bulkAffairActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { ids, action, rejectionReason } = parsed.data;

    const publicationStatus = action === "publish" ? "PUBLISHED" : "REJECTED";

    const result = await db.affair.updateMany({
      where: { id: { in: ids } },
      data: {
        publicationStatus,
        ...(action === "reject" ? { rejectionReason } : {}),
      },
    });

    // Audit log for each
    await db.auditLog.createMany({
      data: ids.map((id) => ({
        action: "UPDATE",
        entityType: "Affair",
        entityId: id,
        changes: { publicationStatus, ...(rejectionReason ? { rejectionReason } : {}) },
      })),
    });

    invalidateEntity("affair");

    return NextResponse.json({ updated: result.count });
  } catch (error) {
    console.error("Bulk action error:", error);
    return NextResponse.json({ error: "Erreur lors de l'action groupée" }, { status: 500 });
  }
}
