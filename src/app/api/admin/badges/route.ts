import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";

export async function GET() {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const [affairsDraft, politiciansDraft] = await Promise.all([
    db.affair.count({ where: { publicationStatus: "DRAFT" } }),
    db.politician.count({ where: { publicationStatus: "DRAFT" } }),
  ]);

  return NextResponse.json({ affairsDraft, politiciansDraft });
}
