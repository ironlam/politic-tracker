import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { withValidation } from "@/lib/security/validate";
import { moderateAffairSchema } from "@/lib/security/schemas/affair";
import { invalidateEntity } from "@/lib/cache";
import type { PublicationStatus } from "@/generated/prisma";
import type { z } from "zod/v4";

type ModerateBody = z.infer<typeof moderateAffairSchema>;

const ACTION_TO_STATUS: Record<ModerateBody["action"], PublicationStatus> = {
  publish: "PUBLISHED",
  exclude: "EXCLUDED",
  reject: "REJECTED",
  archive: "ARCHIVED",
};

// ─── GET: list pending moderation reviews ───────────────────────────

export const GET = withAdminAuth(async () => {
  const reviews = await db.moderationReview.findMany({
    where: { appliedAt: null },
    include: {
      affair: {
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          category: true,
          publicationStatus: true,
          politician: {
            select: {
              fullName: true,
              photoUrl: true,
              slug: true,
            },
          },
          sources: {
            select: {
              id: true,
              sourceType: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const stats = {
    total: reviews.length,
    publish: reviews.filter((r) => r.recommendation === "PUBLISH").length,
    reject: reviews.filter((r) => r.recommendation === "REJECT").length,
    needsReview: reviews.filter((r) => r.recommendation === "NEEDS_REVIEW").length,
  };

  return NextResponse.json({ reviews, stats });
});

// ─── POST: moderate affairs by changing publication status ───────────

export const POST = withAdminAuth(
  withValidation(moderateAffairSchema, async (_request, _context, body: ModerateBody) => {
    const { ids, action } = body;
    const publicationStatus = ACTION_TO_STATUS[action];

    const result = await db.affair.updateMany({
      where: { id: { in: ids } },
      data: { publicationStatus },
    });

    // Audit log for each
    await db.auditLog.createMany({
      data: ids.map((id) => ({
        action: "UPDATE" as const,
        entityType: "Affair",
        entityId: id,
        changes: { publicationStatus, moderationAction: action },
      })),
    });

    invalidateEntity("affair");

    return NextResponse.json({ updated: result.count });
  })
);
