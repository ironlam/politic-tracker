import { NextRequest, NextResponse } from "next/server";
import { withCache } from "@/lib/cache";
import { getElectionMapData } from "@/services/electionMap";

export interface MapDepartmentData {
  code: string;
  name: string;
  region: string;
  totalSeats: number;
  winningParty: {
    id: string;
    name: string;
    shortName: string;
    color: string | null;
    seats: number;
    politicalPosition: string | null;
  } | null;
  parties: {
    id: string;
    name: string;
    shortName: string;
    color: string | null;
    seats: number;
    totalVotes: number;
    politicalPosition: string | null;
  }[];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const electionSlug = searchParams.get("election") || "legislatives-2024";

  try {
    const { departments } = await getElectionMapData(electionSlug);
    return withCache(NextResponse.json({ departments, election: electionSlug }), "daily");
  } catch (error) {
    console.error("API /carte error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
