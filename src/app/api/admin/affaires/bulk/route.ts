import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { invalidateEntity } from "@/lib/cache";

interface BulkInput {
  ids: string[];
  action: "publish" | "reject";
  rejectionReason?: string;
}

export async function POST(request: NextRequest) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const { ids, action, rejectionReason }: BulkInput = await request.json();

    if (!ids?.length || !action) {
      return NextResponse.json({ error: "ids et action requis" }, { status: 400 });
    }

    if (action === "reject" && !rejectionReason) {
      return NextResponse.json({ error: "Motif de rejet requis" }, { status: 400 });
    }

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
