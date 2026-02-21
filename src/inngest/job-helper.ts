import { Prisma } from "@/generated/prisma";
import type { InputJsonValue } from "@/generated/prisma/runtime/client";
import { db } from "@/lib/db";

export async function markJobRunning(jobId: string) {
  await db.syncJob.update({
    where: { id: jobId },
    data: { status: "RUNNING", startedAt: new Date() },
  });
}

export async function markJobCompleted(jobId: string, result?: InputJsonValue) {
  await db.syncJob.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      progress: 100,
      completedAt: new Date(),
      result: result ?? Prisma.DbNull,
    },
  });
}

export async function markJobFailed(jobId: string, error: string) {
  await db.syncJob.update({
    where: { id: jobId },
    data: {
      status: "FAILED",
      completedAt: new Date(),
      error: error.slice(0, 2000),
    },
  });
}

export async function updateJobProgress(jobId: string, progress: number, processed?: number) {
  await db.syncJob.update({
    where: { id: jobId },
    data: {
      progress,
      ...(processed != null ? { processed } : {}),
    },
  });
}
