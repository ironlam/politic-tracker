import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { withValidation, getRequestMeta } from "@/lib/security";
import { quickUpdateAffairSchema } from "@/lib/security/schemas/affair";
import { invalidateEntity } from "@/lib/cache";
import { trackStatusChange } from "@/services/affairs/status-tracking";
import type { AffairStatus } from "@/generated/prisma";
import type { z } from "zod/v4";

type QuickUpdateBody = z.infer<typeof quickUpdateAffairSchema>;

export const PATCH = withAdminAuth(
  withValidation(quickUpdateAffairSchema, async (request, context, body: QuickUpdateBody) => {
    const { id } = await context.params;

    const affair = await db.affair.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        involvement: true,
        slug: true,
        politicianId: true,
      },
    });

    if (!affair) {
      return NextResponse.json({ error: "Affaire non trouvée" }, { status: 404 });
    }

    const updateData: Record<string, string> = {};

    if (body.involvement !== undefined) {
      updateData.involvement = body.involvement;
    }
    if (body.status !== undefined) {
      updateData.status = body.status;
    }
    if (body.severity !== undefined) {
      updateData.severity = body.severity;
    }
    if (body.publicationStatus !== undefined) {
      updateData.publicationStatus = body.publicationStatus;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Aucun champ à mettre à jour" }, { status: 400 });
    }

    // Track status change if applicable
    if (updateData.status && updateData.status !== affair.status) {
      await trackStatusChange(affair.id, affair.status, updateData.status as AffairStatus, {
        type: "MANUAL",
        title: "Modification manuelle depuis l'admin",
      });
    }

    const updated = await db.affair.update({
      where: { id },
      data: updateData,
    });

    // Audit log
    const meta = getRequestMeta(request);
    await db.auditLog.create({
      data: {
        action: "UPDATE",
        entityType: "Affair",
        entityId: id!,
        changes: updateData,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    invalidateEntity("affair", affair.slug);

    return NextResponse.json(updated);
  })
);
