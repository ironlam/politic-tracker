import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";

export async function GET() {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

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
