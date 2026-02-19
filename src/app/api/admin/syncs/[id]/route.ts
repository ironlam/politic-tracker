import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await context.params;

  const job = await db.syncJob.findUnique({ where: { id } });
  if (!job) {
    return NextResponse.json({ error: "Job non trouvé" }, { status: 404 });
  }

  return NextResponse.json(job);
}

/**
 * Cancel a running/pending sync job
 */
export async function PATCH(_request: NextRequest, context: RouteContext) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

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
}
