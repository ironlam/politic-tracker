import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { invalidateEntity } from "@/lib/cache";
import { bulkAffairActionSchema } from "@/lib/validations/affairs";

export const POST = withAdminAuth(async (request: NextRequest) => {
  const body = await request.json();

  const parsed = bulkAffairActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { ids, action, rejectionReason } = parsed.data;

  if (action === "delete") {
    const result = await db.affair.deleteMany({
      where: { id: { in: ids } },
    });

    await db.auditLog.createMany({
      data: ids.map((id) => ({
        action: "DELETE" as const,
        entityType: "Affair",
        entityId: id,
        changes: { bulkDelete: true },
      })),
    });

    invalidateEntity("affair");

    return NextResponse.json({ deleted: result.count });
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
      action: "UPDATE" as const,
      entityType: "Affair",
      entityId: id,
      changes: { publicationStatus, ...(rejectionReason ? { rejectionReason } : {}) },
    })),
  });

  invalidateEntity("affair");

  return NextResponse.json({ updated: result.count });
});
