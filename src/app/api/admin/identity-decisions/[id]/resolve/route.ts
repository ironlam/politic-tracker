import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { withValidation } from "@/lib/security/validate";
import { resolveIdentitySchema } from "@/lib/security/schemas";
import { Judgement, MatchMethod } from "@/generated/prisma";

export const POST = withAdminAuth(
  withValidation(resolveIdentitySchema, async (_request, context, { judgement, politicianId }) => {
    const { id } = await context.params;

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
  })
);
