import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const parties = await db.party.findMany({
      select: {
        id: true,
        name: true,
        shortName: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(parties);
  } catch (error) {
    console.error("Error fetching parties:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des partis" },
      { status: 500 }
    );
  }
}
