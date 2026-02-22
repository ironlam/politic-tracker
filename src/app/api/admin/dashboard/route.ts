import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const [
    totalPoliticians,
    politiciansWithoutPhoto,
    politiciansDraft,
    biographiesMissing,
    totalAffairs,
    affairsDraft,
    affairsWithoutEcli,
    recentActivity,
    syncHistory,
  ] = await Promise.all([
    db.politician.count(),
    db.politician.count({ where: { photoUrl: null, publicationStatus: "PUBLISHED" } }),
    db.politician.count({ where: { publicationStatus: "DRAFT" } }),
    db.politician.count({ where: { biography: null, publicationStatus: "PUBLISHED" } }),
    db.affair.count(),
    db.affair.count({ where: { publicationStatus: "DRAFT" } }),
    db.affair.count({ where: { ecli: null, publicationStatus: "PUBLISHED" } }),
    db.auditLog.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
    }),
    db.syncJob.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    dataHealth: {
      totalPoliticians,
      politiciansWithoutPhoto,
      politiciansDraft,
      biographiesMissing,
      totalAffairs,
      affairsDraft,
      affairsWithoutEcli,
    },
    recentActivity,
    syncHistory,
  });
}
