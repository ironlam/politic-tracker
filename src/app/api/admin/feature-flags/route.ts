import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { withValidation, getRequestMeta } from "@/lib/security";
import { createFeatureFlagSchema } from "@/lib/security/schemas/feature-flag";
import { revalidateTags } from "@/lib/cache";
import type { z } from "zod/v4";

type CreateFeatureFlagBody = z.infer<typeof createFeatureFlagSchema>;

export const GET = withAdminAuth(async () => {
  const flags = await db.featureFlag.findMany({
    orderBy: { name: "asc" },
  });

  return NextResponse.json(flags);
});

export const POST = withAdminAuth(
  withValidation(
    createFeatureFlagSchema,
    async (request, _context, body: CreateFeatureFlagBody) => {
      const flag = await db.featureFlag.create({ data: body });

      // Audit log
      const meta = getRequestMeta(request);
      await db.auditLog.create({
        data: {
          action: "CREATE",
          entityType: "FeatureFlag",
          entityId: flag.id,
          changes: body,
          ipAddress: meta.ip,
          userAgent: meta.userAgent,
        },
      });

      revalidateTags(["feature-flags"]);

      return NextResponse.json(flag, { status: 201 });
    }
  )
);
