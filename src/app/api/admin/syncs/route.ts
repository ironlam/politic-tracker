import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";

const STALE_JOB_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export async function GET(request: NextRequest) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // Cleanup stale jobs (stuck PENDING/RUNNING > 30 minutes)
  await db.syncJob.updateMany({
    where: {
      status: { in: ["PENDING", "RUNNING"] },
      createdAt: { lt: new Date(Date.now() - STALE_JOB_TIMEOUT_MS) },
    },
    data: {
      status: "FAILED",
      error: "Timeout : job bloqué depuis plus de 30 minutes",
      completedAt: new Date(),
    },
  });

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const skip = (page - 1) * limit;

  const [jobs, total, running] = await Promise.all([
    db.syncJob.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    db.syncJob.count(),
    db.syncJob.findMany({
      where: { status: { in: ["PENDING", "RUNNING"] } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    data: jobs,
    running,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { script } = await request.json();
  if (!script || typeof script !== "string") {
    return NextResponse.json({ error: "Script requis" }, { status: 400 });
  }

  // Check if this script is already running
  const existing = await db.syncJob.findFirst({
    where: { script, status: { in: ["PENDING", "RUNNING"] } },
  });
  if (existing) {
    return NextResponse.json({ error: "Ce script est déjà en cours d'exécution" }, { status: 409 });
  }

  const job = await db.syncJob.create({
    data: { script, status: "PENDING" },
  });

  // Trigger via Inngest
  try {
    const { inngest } = await import("@/inngest/client");
    await inngest.send({
      name: `sync/${script}`,
      data: { jobId: job.id },
    });
  } catch (err) {
    console.error("Failed to send Inngest event:", err);
    await db.syncJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        error: "Impossible d'envoyer l'événement Inngest",
        completedAt: new Date(),
      },
    });
    return NextResponse.json({ error: "Erreur Inngest" }, { status: 503 });
  }

  return NextResponse.json(job, { status: 201 });
}
