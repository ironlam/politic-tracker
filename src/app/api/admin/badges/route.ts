import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const affairsDraft = await db.affair.count({
    where: { publicationStatus: "DRAFT" },
  });

  return NextResponse.json({ affairsDraft });
}
