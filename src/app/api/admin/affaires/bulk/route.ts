import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { withValidation } from "@/lib/security/validate";
import { bulkAffairSchema } from "@/lib/security/schemas/affair";
import { invalidateEntity } from "@/lib/cache";
import type { z } from "zod/v4";

type BulkBody = z.infer<typeof bulkAffairSchema>;

export const POST = withAdminAuth(
  withValidation(bulkAffairSchema, async (_request, _context, body: BulkBody) => {
    const { ids, action, value } = body;
    const rejectionReason = typeof value === "string" ? value : undefined;

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
  })
);
