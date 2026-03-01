import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { Judgement, MatchMethod } from "@/generated/prisma";

export const POST = withAdminAuth(async (request, context) => {
  const { id } = await context.params;
  const body = await request.json();
  const { judgement, politicianId } = body as {
    judgement: "SAME" | "NOT_SAME";
    politicianId?: string;
  };

  if (!judgement || !["SAME", "NOT_SAME"].includes(judgement)) {
    return NextResponse.json({ error: "judgement must be SAME or NOT_SAME" }, { status: 400 });
  }

  const original = await db.identityDecision.findUnique({
    where: { id },
  });

  if (!original) {
    return NextResponse.json({ error: "Decision not found" }, { status: 404 });
  }

  if (original.supersededBy) {
    return NextResponse.json({ error: "Decision already superseded" }, { status: 409 });
  }

  const targetPoliticianId =
    judgement === "SAME" ? (politicianId ?? original.politicianId) : original.politicianId;

  // Create the superseding decision
  const newDecision = await db.identityDecision.create({
    data: {
      sourceType: original.sourceType,
      sourceId: original.sourceId,
      politicianId: targetPoliticianId,
      judgement: judgement === "SAME" ? Judgement.SAME : Judgement.NOT_SAME,
      confidence: 1.0,
      method: MatchMethod.MANUAL,
      evidence: {
        originalDecisionId: original.id,
        originalJudgement: original.judgement,
        resolvedBy: "admin",
      },
      decidedBy: "admin:manual",
    },
  });

  // Mark original as superseded
  await db.identityDecision.update({
    where: { id },
    data: { supersededBy: newDecision.id },
  });

  return NextResponse.json(newDecision);
});
