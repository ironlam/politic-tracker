import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DEPARTMENTS } from "@/config/departments";
import { withCache } from "@/lib/cache";

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
    // Get all elected candidacies for this election
    const candidacies = await db.candidacy.findMany({
      where: {
        election: { slug: electionSlug },
        isElected: true,
      },
      select: {
        constituencyCode: true,
        constituencyName: true,
        partyId: true,
        partyLabel: true,
        party: {
          select: {
            id: true,
            name: true,
            shortName: true,
            color: true,
            politicalPosition: true,
          },
        },
        round2Votes: true,
        round2Pct: true,
      },
    });

    // Group by department code
    const deptMap = new Map<string, MapDepartmentData>();

    for (const c of candidacies) {
      // Extract dept code from constituency code
      const circoCode = c.constituencyCode || "";
      const deptCode = circoCode.startsWith("97")
        ? circoCode.slice(0, 3) // DOM-TOM: 97101 → 971
        : circoCode.slice(0, 2); // Métropole: 0101 → 01

      if (!deptMap.has(deptCode)) {
        const deptInfo = DEPARTMENTS[deptCode];
        deptMap.set(deptCode, {
          code: deptCode,
          name: deptInfo?.name || deptCode,
          region: deptInfo?.region || "Inconnu",
          totalSeats: 0,
          winningParty: null,
          parties: [],
        });
      }

      const dept = deptMap.get(deptCode)!;
      dept.totalSeats++;

      // Aggregate by party
      const partyKey = c.party?.id || c.partyLabel || "unknown";
      let partyEntry = dept.parties.find((p) => p.id === partyKey);
      if (!partyEntry) {
        partyEntry = {
          id: c.party?.id || partyKey,
          name: c.party?.name || c.partyLabel || "Inconnu",
          shortName: c.party?.shortName || c.partyLabel || "?",
          color: c.party?.color || null,
          seats: 0,
          totalVotes: 0,
          politicalPosition: c.party?.politicalPosition || null,
        };
        dept.parties.push(partyEntry);
      }
      partyEntry.seats++;
      partyEntry.totalVotes += c.round2Votes || 0;
    }

    // Set winning party per department (strictly more seats than 2nd)
    for (const dept of deptMap.values()) {
      dept.parties.sort((a, b) => b.seats - a.seats);
      if (
        dept.parties.length === 1 ||
        (dept.parties.length > 1 && dept.parties[0].seats > dept.parties[1].seats)
      ) {
        dept.winningParty = dept.parties[0];
      }
    }

    const departments = Array.from(deptMap.values()).sort((a, b) =>
      a.code.localeCompare(b.code, "fr", { numeric: true })
    );

    return withCache(NextResponse.json({ departments, election: electionSlug }), "daily");
  } catch (error) {
    console.error("API /carte error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
