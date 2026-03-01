import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/lib/api/with-admin-auth";

export const GET = withAdminAuth(async (_request: NextRequest, context) => {
  const { id } = await context.params;

  const job = await db.syncJob.findUnique({ where: { id } });
  if (!job) {
    return NextResponse.json({ error: "Job non trouvé" }, { status: 404 });
  }

  return NextResponse.json(job);
});

/**
 * Cancel a running/pending sync job
 */
export const PATCH = withAdminAuth(async (_request: NextRequest, context) => {
  const { id } = await context.params;

  const job = await db.syncJob.findUnique({ where: { id } });
  if (!job) {
    return NextResponse.json({ error: "Job non trouvé" }, { status: 404 });
  }

  if (job.status !== "PENDING" && job.status !== "RUNNING") {
    return NextResponse.json({ error: "Ce job n'est pas en cours" }, { status: 400 });
  }

  const updated = await db.syncJob.update({
    where: { id },
    data: {
      status: "FAILED",
      error: "Annulé manuellement par l'administrateur",
      completedAt: new Date(),
    },
  });

  return NextResponse.json(updated);
});
