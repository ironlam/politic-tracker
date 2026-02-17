import { Metadata } from "next";
import { CarteClient } from "./CarteClient";
import { db } from "@/lib/db";
import { MandateType } from "@/generated/prisma";
import { DEPARTMENTS } from "@/config/departments";

export const metadata: Metadata = {
  title: "Carte des Élus | Poligraph",
  description:
    "Carte interactive des députés et sénateurs par département. Visualisez la répartition politique de vos représentants en France métropolitaine et outre-mer.",
  openGraph: {
    title: "Carte des Élus | Poligraph",
    description:
      "Carte interactive des députés et sénateurs par département. Visualisez la répartition politique de vos représentants.",
    type: "website",
  },
};

interface DepartmentStats {
  code: string;
  name: string;
  region: string;
  totalElus: number;
  deputes: number;
  senateurs: number;
  dominantParty: {
    id: string;
    name: string;
    shortName: string;
    color: string | null;
    count: number;
  } | null;
  parties: {
    id: string;
    name: string;
    shortName: string;
    color: string | null;
    count: number;
  }[];
}

async function getDepartmentStats(): Promise<{
  departments: DepartmentStats[];
  stats: {
    totalDepartments: number;
    totalElus: number;
    totalDeputes: number;
    totalSenateurs: number;
  };
}> {
  // Get all current mandates with department codes, grouped by department and party
  const mandatesByDept = await db.$queryRaw<
    {
      departmentCode: string;
      mandateType: MandateType;
      partyId: string | null;
      partyName: string | null;
      partyShortName: string | null;
      partyColor: string | null;
      count: bigint;
    }[]
  >`
    SELECT
      m."departmentCode",
      m.type as "mandateType",
      p.id as "partyId",
      p.name as "partyName",
      p."shortName" as "partyShortName",
      p.color as "partyColor",
      COUNT(DISTINCT pol.id) as count
    FROM "Mandate" m
    JOIN "Politician" pol ON m."politicianId" = pol.id
    LEFT JOIN "Party" p ON pol."currentPartyId" = p.id
    WHERE m."isCurrent" = true
      AND m."departmentCode" IS NOT NULL
      AND m.type IN ('DEPUTE', 'SENATEUR')
    GROUP BY m."departmentCode", m.type, p.id, p.name, p."shortName", p.color
    ORDER BY m."departmentCode", count DESC
  `;

  // Aggregate stats by department
  const deptMap = new Map<string, DepartmentStats>();

  for (const row of mandatesByDept) {
    const code = row.departmentCode;
    const deptInfo = DEPARTMENTS[code];

    if (!deptMap.has(code)) {
      deptMap.set(code, {
        code,
        name: deptInfo?.name || code,
        region: deptInfo?.region || "Inconnu",
        totalElus: 0,
        deputes: 0,
        senateurs: 0,
        dominantParty: null,
        parties: [],
      });
    }

    const dept = deptMap.get(code)!;
    const count = Number(row.count);

    dept.totalElus += count;

    if (row.mandateType === MandateType.DEPUTE) {
      dept.deputes += count;
    } else if (row.mandateType === MandateType.SENATEUR) {
      dept.senateurs += count;
    }

    // Track party stats
    if (row.partyId) {
      const existingParty = dept.parties.find((p) => p.id === row.partyId);
      if (existingParty) {
        existingParty.count += count;
      } else {
        dept.parties.push({
          id: row.partyId,
          name: row.partyName || "Inconnu",
          shortName: row.partyShortName || "?",
          color: row.partyColor,
          count,
        });
      }
    }
  }

  // Calculate dominant party for each department
  for (const dept of deptMap.values()) {
    // Sort parties by count (descending)
    dept.parties.sort((a, b) => b.count - a.count);

    // Set dominant party only if the top party has strictly more representatives than the second
    if (
      dept.parties.length === 1 ||
      (dept.parties.length > 1 && dept.parties[0].count > dept.parties[1].count)
    ) {
      dept.dominantParty = dept.parties[0];
    }
  }

  // Convert to array and sort by department code
  const departments = Array.from(deptMap.values()).sort((a, b) =>
    a.code.localeCompare(b.code, "fr", { numeric: true })
  );

  // Calculate global stats
  const totalStats = {
    totalDepartments: departments.length,
    totalElus: departments.reduce((sum, d) => sum + d.totalElus, 0),
    totalDeputes: departments.reduce((sum, d) => sum + d.deputes, 0),
    totalSenateurs: departments.reduce((sum, d) => sum + d.senateurs, 0),
  };

  return { departments, stats: totalStats };
}

export default async function CartePage() {
  const { departments, stats } = await getDepartmentStats();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Carte des Élus</h1>
        <p className="text-muted-foreground">
          Visualisez la répartition des députés et sénateurs par département. Cliquez sur un
          département pour voir les détails.
        </p>
      </div>

      <CarteClient initialDepartments={departments} initialStats={stats} />
    </div>
  );
}
