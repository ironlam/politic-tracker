import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { invalidateEntity } from "@/lib/cache";
import { applyModerationSchema } from "@/lib/validations/affairs";
import { trackStatusChange } from "@/services/affairs/status-tracking";
import type { SourceType } from "@/generated/prisma";

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

// ─── POST: apply or dismiss moderation reviews ──────────────────────

export const POST = withAdminAuth(async (request: NextRequest) => {
  const body = await request.json();

  const parsed = applyModerationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { reviewIds, action } = parsed.data;

  // ── Dismiss: mark reviews as dismissed without applying changes ──
  if (action === "dismiss") {
    const result = await db.moderationReview.updateMany({
      where: { id: { in: reviewIds }, appliedAt: null },
      data: {
        appliedAt: new Date(),
        appliedBy: "admin:dismissed",
      },
    });

    return NextResponse.json({ dismissed: result.count });
  }

  // ── Apply: process each review and update the affair ──
  const reviews = await db.moderationReview.findMany({
    where: { id: { in: reviewIds }, appliedAt: null },
    include: {
      affair: {
        select: {
          id: true,
          status: true,
          title: true,
          description: true,
          category: true,
          publicationStatus: true,
        },
      },
    },
  });

  let appliedCount = 0;

  for (const review of reviews) {
    const affair = review.affair;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const affairUpdate: Record<string, any> = {};

    // Publication status based on recommendation
    if (review.recommendation === "PUBLISH") {
      affairUpdate.publicationStatus = "PUBLISHED";
      affairUpdate.verifiedAt = new Date();
      affairUpdate.verifiedBy = "Poligraph Moderation";
    } else if (review.recommendation === "REJECT") {
      affairUpdate.publicationStatus = "REJECTED";
      affairUpdate.rejectionReason = review.reasoning;
    }
    // NEEDS_REVIEW: no publicationStatus change

    // Apply suggested corrections
    if (review.suggestedTitle) {
      affairUpdate.title = review.suggestedTitle;
    }
    if (review.suggestedDescription) {
      affairUpdate.description = review.suggestedDescription;
    }
    if (review.suggestedCategory) {
      affairUpdate.category = review.suggestedCategory;
    }

    // Status change with tracking
    if (review.suggestedStatus && review.suggestedStatus !== affair.status) {
      affairUpdate.status = review.suggestedStatus;

      await trackStatusChange(affair.id, affair.status, review.suggestedStatus, {
        type: "MANUAL" as SourceType,
        title: "Correction via auto-modération IA",
      });
    }

    // Update the affair
    if (Object.keys(affairUpdate).length > 0) {
      await db.affair.update({
        where: { id: affair.id },
        data: affairUpdate,
      });
    }

    // Mark the review as applied
    await db.moderationReview.update({
      where: { id: review.id },
      data: {
        appliedAt: new Date(),
        appliedBy: "admin",
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        action: "UPDATE",
        entityType: "Affair",
        entityId: affair.id,
        changes: {
          source: "auto-moderation",
          recommendation: review.recommendation,
          ...affairUpdate,
        },
      },
    });

    appliedCount++;
  }

  invalidateEntity("affair");

  return NextResponse.json({ applied: appliedCount });
});
