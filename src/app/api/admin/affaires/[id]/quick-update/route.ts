import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { invalidateEntity } from "@/lib/cache";
import { trackStatusChange } from "@/services/affairs/status-tracking";
import type { AffairStatus, Involvement } from "@/generated/prisma";

const VALID_STATUSES: AffairStatus[] = [
  "ENQUETE_PRELIMINAIRE",
  "INSTRUCTION",
  "MISE_EN_EXAMEN",
  "RENVOI_TRIBUNAL",
  "PROCES_EN_COURS",
  "CONDAMNATION_PREMIERE_INSTANCE",
  "APPEL_EN_COURS",
  "CONDAMNATION_DEFINITIVE",
  "RELAXE",
  "ACQUITTEMENT",
  "NON_LIEU",
  "PRESCRIPTION",
  "CLASSEMENT_SANS_SUITE",
];

const VALID_INVOLVEMENTS: Involvement[] = [
  "DIRECT",
  "INDIRECT",
  "MENTIONED_ONLY",
  "VICTIM",
  "PLAINTIFF",
];

export const PATCH = withAdminAuth(async (request: NextRequest, context) => {
  const { id } = await context.params;

  const body = await request.json();

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

  // Validate and set involvement
  if (body.involvement !== undefined) {
    if (!VALID_INVOLVEMENTS.includes(body.involvement)) {
      return NextResponse.json({ error: "Involvement invalide" }, { status: 400 });
    }
    updateData.involvement = body.involvement;
  }

  // Validate and set status
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
    }
    updateData.status = body.status;
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
  await db.auditLog.create({
    data: {
      action: "UPDATE",
      entityType: "Affair",
      entityId: id!,
      changes: updateData,
    },
  });

  invalidateEntity("affair", affair.slug);

  return NextResponse.json(updated);
});
