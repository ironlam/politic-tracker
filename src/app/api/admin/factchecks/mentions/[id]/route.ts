import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { invalidateEntity } from "@/lib/cache";
import { getRequestMeta } from "@/lib/security/audit";

export const DELETE = withAdminAuth(async (request: NextRequest, context) => {
  const { id } = await context.params;

  const mention = await db.factCheckMention.findUnique({
    where: { id },
    select: {
      id: true,
      politician: { select: { slug: true, fullName: true } },
      factCheck: { select: { title: true } },
    },
  });

  if (!mention) {
    return NextResponse.json({ error: "Mention non trouvée" }, { status: 404 });
  }

  await db.factCheckMention.delete({ where: { id } });

  const { ip, userAgent } = getRequestMeta(request);
  await db.auditLog.create({
    data: {
      action: "DELETE",
      entityType: "FactCheckMention",
      entityId: id!,
      changes: {
        politician: mention.politician.fullName,
        factCheck: mention.factCheck.title,
      },
      ipAddress: ip,
      userAgent,
    },
  });

  invalidateEntity("factcheck");
  invalidateEntity("politician", mention.politician.slug);

  return NextResponse.json({ success: true });
});
