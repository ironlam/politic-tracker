import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DataSource } from "@/generated/prisma";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { invalidateEntity } from "@/lib/cache";
import { getRequestMeta } from "@/lib/security/audit";
import { recordMentionBlock } from "@/lib/identity/mention-blocklist";

export const DELETE = withAdminAuth(async (request: NextRequest, context) => {
  const { id } = await context.params;

  const mention = await db.pressArticleMention.findUnique({
    where: { id },
    select: {
      id: true,
      matchedName: true,
      politicianId: true,
      politician: { select: { slug: true, fullName: true } },
      article: { select: { title: true } },
    },
  });

  if (!mention) {
    return NextResponse.json({ error: "Mention non trouvée" }, { status: 404 });
  }

  await db.pressArticleMention.delete({ where: { id } });

  // Record NOT_SAME decision so this false positive won't recur
  if (mention.matchedName) {
    await recordMentionBlock({
      sourceType: DataSource.PRESS,
      matchedName: mention.matchedName,
      politicianId: mention.politicianId,
      politicianFullName: mention.politician.fullName,
      contextTitle: mention.article.title,
      decidedBy: "admin:press-unlink",
    });
  }

  const { ip, userAgent } = getRequestMeta(request);
  await db.auditLog.create({
    data: {
      action: "DELETE",
      entityType: "PressArticleMention",
      entityId: id!,
      changes: {
        politician: mention.politician.fullName,
        article: mention.article.title,
      },
      ipAddress: ip,
      userAgent,
    },
  });

  invalidateEntity("politician", mention.politician.slug);

  return NextResponse.json({ success: true });
});
