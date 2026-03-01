import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/lib/api/with-admin-auth";

export const GET = withAdminAuth(async () => {
  const [affairsDraft, politiciansDraft] = await Promise.all([
    db.affair.count({ where: { publicationStatus: "DRAFT" } }),
    db.politician.count({ where: { publicationStatus: "DRAFT" } }),
  ]);

  return NextResponse.json({ affairsDraft, politiciansDraft });
});
