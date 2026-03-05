import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { withValidation } from "@/lib/security/validate";
import { revalidateCacheSchema } from "@/lib/security/schemas";
import { db } from "@/lib/db";
import { revalidateAll, revalidateTags } from "@/lib/cache";

/**
 * POST /api/admin/cache/revalidate
 *
 * Invalidate Next.js cache from the admin UI.
 * Body: { all: true } or { tags: CacheTag[] }
 */
export const POST = withAdminAuth(
  withValidation(revalidateCacheSchema, async (_request, _context, body) => {
    if ("all" in body) {
      revalidateAll();

      await db.auditLog.create({
        data: {
          action: "INVALIDATE",
          entityType: "Cache",
          entityId: "all",
          changes: { scope: "all" },
        },
      });

      return NextResponse.json({ revalidated: "all" });
    }

    revalidateTags(body.tags);

    await db.auditLog.create({
      data: {
        action: "INVALIDATE",
        entityType: "Cache",
        entityId: body.tags.join(","),
        changes: { scope: "selective", tags: body.tags },
      },
    });

    return NextResponse.json({ revalidated: body.tags });
  })
);
