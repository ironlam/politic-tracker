import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { withValidation, getRequestMeta } from "@/lib/security";
import { updateFeatureFlagSchema } from "@/lib/security/schemas/feature-flag";
import { revalidateTags } from "@/lib/cache";
import { revalidatePath } from "next/cache";
import type { z } from "zod/v4";

type UpdateFeatureFlagBody = z.infer<typeof updateFeatureFlagSchema>;

export const PUT = withAdminAuth(
  withValidation(updateFeatureFlagSchema, async (request, context, body: UpdateFeatureFlagBody) => {
    const { id } = await context.params;

    const flag = await db.featureFlag.update({
      where: { id },
      data: {
        ...(body.label !== undefined && { label: body.label }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.enabled !== undefined && { enabled: body.enabled }),
        ...(body.value !== undefined && { value: body.value as string }),
        ...(body.startDate !== undefined && {
          startDate: body.startDate ? new Date(body.startDate) : null,
        }),
        ...(body.endDate !== undefined && {
          endDate: body.endDate ? new Date(body.endDate) : null,
        }),
      },
    });

    // Audit log
    const meta = getRequestMeta(request);
    await db.auditLog.create({
      data: {
        action: "UPDATE",
        entityType: "FeatureFlag",
        entityId: id!,
        changes: body as Record<string, string>,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    revalidateTags(["feature-flags"]);
    revalidatePath("/", "layout");
    return NextResponse.json(flag);
  })
);

export const DELETE = withAdminAuth(async (request, context) => {
  const { id } = await context.params;
  await db.featureFlag.delete({ where: { id } });

  // Audit log
  const meta = getRequestMeta(request);
  await db.auditLog.create({
    data: {
      action: "DELETE",
      entityType: "FeatureFlag",
      entityId: id!,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    },
  });

  revalidateTags(["feature-flags"]);
  revalidatePath("/", "layout");

  return NextResponse.json({ success: true });
});
