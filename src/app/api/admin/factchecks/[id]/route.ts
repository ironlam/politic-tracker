import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { invalidateEntity } from "@/lib/cache";
import { getRequestMeta } from "@/lib/security/audit";

export const DELETE = withAdminAuth(async (request: NextRequest, context) => {
  const { id } = await context.params;

  const factCheck = await db.factCheck.findUnique({
    where: { id },
    select: { id: true, title: true },
  });

  if (!factCheck) {
    return NextResponse.json({ error: "Fact-check non trouvé" }, { status: 404 });
  }

  // Cascade: mentions
  await db.factCheck.delete({ where: { id } });

  const { ip, userAgent } = getRequestMeta(request);
  await db.auditLog.create({
    data: {
      action: "DELETE",
      entityType: "FactCheck",
      entityId: id!,
      changes: { title: factCheck.title },
      ipAddress: ip,
      userAgent,
    },
  });

  invalidateEntity("factcheck");

  return NextResponse.json({ success: true });
});
