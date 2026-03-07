import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { invalidateEntity } from "@/lib/cache";
import { getRequestMeta } from "@/lib/security/audit";

export const DELETE = withAdminAuth(async (request: NextRequest, context) => {
  const { id } = await context.params;

  const article = await db.pressArticle.findUnique({
    where: { id },
    select: { id: true, title: true },
  });

  if (!article) {
    return NextResponse.json({ error: "Article non trouvé" }, { status: 404 });
  }

  // Cascade: mentions, partyMentions, affairLinks, rejections
  await db.pressArticle.delete({ where: { id } });

  const { ip, userAgent } = getRequestMeta(request);
  await db.auditLog.create({
    data: {
      action: "DELETE",
      entityType: "PressArticle",
      entityId: id!,
      changes: { title: article.title },
      ipAddress: ip,
      userAgent,
    },
  });

  invalidateEntity("politician");

  return NextResponse.json({ success: true });
});
