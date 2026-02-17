import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";

export async function POST() {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  const result = await db.auditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  return NextResponse.json({ deleted: result.count });
}
