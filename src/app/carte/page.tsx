import { Metadata } from "next";
import { CarteClient } from "./CarteClient";
import { db } from "@/lib/db";
import { DEPARTMENTS } from "@/config/departments";
import type { MapDepartmentData } from "@/app/api/carte/route";

export const metadata: Metadata = {
  title: "Carte des Résultats Électoraux | Poligraph",
  description:
    "Carte interactive des résultats électoraux par département. Visualisez la répartition politique des sièges aux législatives 2024 en France métropolitaine et outre-mer.",
  openGraph: {
    title: "Carte des Résultats Électoraux | Poligraph",
    description:
      "Carte interactive des résultats électoraux par département. Visualisez la répartition politique des sièges aux législatives 2024.",
    type: "website",
  },
};

async function getElectionMapData(): Promise<{
  departments: MapDepartmentData[];
  totalSeats: number;
}> {
  const candidacies = await db.candidacy.findMany({
    where: {
      election: { slug: "legislatives-2024" },
      isElected: true,
    },
    select: {
      constituencyCode: true,
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

  return {
    departments,
    totalSeats: departments.reduce((sum, d) => sum + d.totalSeats, 0),
  };
}

export default async function CartePage() {
  const { departments, totalSeats } = await getElectionMapData();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Carte des Résultats Électoraux</h1>
        <p className="text-muted-foreground">
          Visualisez les résultats des législatives 2024 par département. Cliquez sur un département
          pour voir les détails.
        </p>
      </div>

      <CarteClient initialDepartments={departments} totalSeats={totalSeats} />
    </div>
  );
}
