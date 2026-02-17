import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

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

  // Trigger the worker (Fly.io or local)
  const workerUrl = process.env.SYNC_WORKER_URL;
  if (workerUrl) {
    try {
      await fetch(`${workerUrl}/sync/${script}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.SYNC_WORKER_SECRET}`,
        },
        body: JSON.stringify({ jobId: job.id }),
      });
    } catch (err) {
      console.error("Failed to trigger worker:", err);
      await db.syncJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          error: "Impossible de contacter le worker",
          completedAt: new Date(),
        },
      });
      return NextResponse.json({ error: "Worker non disponible" }, { status: 503 });
    }
  }

  return NextResponse.json(job, { status: 201 });
}
