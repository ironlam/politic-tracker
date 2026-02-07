import { Metadata } from "next";
import { CarteClient } from "./CarteClient";
import { db } from "@/lib/db";
import { MandateType } from "@/generated/prisma";

export const metadata: Metadata = {
  title: "Carte des Élus | Transparence Politique",
  description:
    "Carte interactive des députés et sénateurs par département. Visualisez la répartition politique de vos représentants en France métropolitaine et outre-mer.",
  openGraph: {
    title: "Carte des Élus | Transparence Politique",
    description:
      "Carte interactive des députés et sénateurs par département. Visualisez la répartition politique de vos représentants.",
    type: "website",
  },
};

// French departments data
const DEPARTMENTS: Record<string, { name: string; region: string }> = {
  "01": { name: "Ain", region: "Auvergne-Rhône-Alpes" },
  "02": { name: "Aisne", region: "Hauts-de-France" },
  "03": { name: "Allier", region: "Auvergne-Rhône-Alpes" },
  "04": { name: "Alpes-de-Haute-Provence", region: "Provence-Alpes-Côte d'Azur" },
  "05": { name: "Hautes-Alpes", region: "Provence-Alpes-Côte d'Azur" },
  "06": { name: "Alpes-Maritimes", region: "Provence-Alpes-Côte d'Azur" },
  "07": { name: "Ardèche", region: "Auvergne-Rhône-Alpes" },
  "08": { name: "Ardennes", region: "Grand Est" },
  "09": { name: "Ariège", region: "Occitanie" },
  "10": { name: "Aube", region: "Grand Est" },
  "11": { name: "Aude", region: "Occitanie" },
  "12": { name: "Aveyron", region: "Occitanie" },
  "13": { name: "Bouches-du-Rhône", region: "Provence-Alpes-Côte d'Azur" },
  "14": { name: "Calvados", region: "Normandie" },
  "15": { name: "Cantal", region: "Auvergne-Rhône-Alpes" },
  "16": { name: "Charente", region: "Nouvelle-Aquitaine" },
  "17": { name: "Charente-Maritime", region: "Nouvelle-Aquitaine" },
  "18": { name: "Cher", region: "Centre-Val de Loire" },
  "19": { name: "Corrèze", region: "Nouvelle-Aquitaine" },
  "2A": { name: "Corse-du-Sud", region: "Corse" },
  "2B": { name: "Haute-Corse", region: "Corse" },
  "21": { name: "Côte-d'Or", region: "Bourgogne-Franche-Comté" },
  "22": { name: "Côtes-d'Armor", region: "Bretagne" },
  "23": { name: "Creuse", region: "Nouvelle-Aquitaine" },
  "24": { name: "Dordogne", region: "Nouvelle-Aquitaine" },
  "25": { name: "Doubs", region: "Bourgogne-Franche-Comté" },
  "26": { name: "Drôme", region: "Auvergne-Rhône-Alpes" },
  "27": { name: "Eure", region: "Normandie" },
  "28": { name: "Eure-et-Loir", region: "Centre-Val de Loire" },
  "29": { name: "Finistère", region: "Bretagne" },
  "30": { name: "Gard", region: "Occitanie" },
  "31": { name: "Haute-Garonne", region: "Occitanie" },
  "32": { name: "Gers", region: "Occitanie" },
  "33": { name: "Gironde", region: "Nouvelle-Aquitaine" },
  "34": { name: "Hérault", region: "Occitanie" },
  "35": { name: "Ille-et-Vilaine", region: "Bretagne" },
  "36": { name: "Indre", region: "Centre-Val de Loire" },
  "37": { name: "Indre-et-Loire", region: "Centre-Val de Loire" },
  "38": { name: "Isère", region: "Auvergne-Rhône-Alpes" },
  "39": { name: "Jura", region: "Bourgogne-Franche-Comté" },
  "40": { name: "Landes", region: "Nouvelle-Aquitaine" },
  "41": { name: "Loir-et-Cher", region: "Centre-Val de Loire" },
  "42": { name: "Loire", region: "Auvergne-Rhône-Alpes" },
  "43": { name: "Haute-Loire", region: "Auvergne-Rhône-Alpes" },
  "44": { name: "Loire-Atlantique", region: "Pays de la Loire" },
  "45": { name: "Loiret", region: "Centre-Val de Loire" },
  "46": { name: "Lot", region: "Occitanie" },
  "47": { name: "Lot-et-Garonne", region: "Nouvelle-Aquitaine" },
  "48": { name: "Lozère", region: "Occitanie" },
  "49": { name: "Maine-et-Loire", region: "Pays de la Loire" },
  "50": { name: "Manche", region: "Normandie" },
  "51": { name: "Marne", region: "Grand Est" },
  "52": { name: "Haute-Marne", region: "Grand Est" },
  "53": { name: "Mayenne", region: "Pays de la Loire" },
  "54": { name: "Meurthe-et-Moselle", region: "Grand Est" },
  "55": { name: "Meuse", region: "Grand Est" },
  "56": { name: "Morbihan", region: "Bretagne" },
  "57": { name: "Moselle", region: "Grand Est" },
  "58": { name: "Nièvre", region: "Bourgogne-Franche-Comté" },
  "59": { name: "Nord", region: "Hauts-de-France" },
  "60": { name: "Oise", region: "Hauts-de-France" },
  "61": { name: "Orne", region: "Normandie" },
  "62": { name: "Pas-de-Calais", region: "Hauts-de-France" },
  "63": { name: "Puy-de-Dôme", region: "Auvergne-Rhône-Alpes" },
  "64": { name: "Pyrénées-Atlantiques", region: "Nouvelle-Aquitaine" },
  "65": { name: "Hautes-Pyrénées", region: "Occitanie" },
  "66": { name: "Pyrénées-Orientales", region: "Occitanie" },
  "67": { name: "Bas-Rhin", region: "Grand Est" },
  "68": { name: "Haut-Rhin", region: "Grand Est" },
  "69": { name: "Rhône", region: "Auvergne-Rhône-Alpes" },
  "70": { name: "Haute-Saône", region: "Bourgogne-Franche-Comté" },
  "71": { name: "Saône-et-Loire", region: "Bourgogne-Franche-Comté" },
  "72": { name: "Sarthe", region: "Pays de la Loire" },
  "73": { name: "Savoie", region: "Auvergne-Rhône-Alpes" },
  "74": { name: "Haute-Savoie", region: "Auvergne-Rhône-Alpes" },
  "75": { name: "Paris", region: "Île-de-France" },
  "76": { name: "Seine-Maritime", region: "Normandie" },
  "77": { name: "Seine-et-Marne", region: "Île-de-France" },
  "78": { name: "Yvelines", region: "Île-de-France" },
  "79": { name: "Deux-Sèvres", region: "Nouvelle-Aquitaine" },
  "80": { name: "Somme", region: "Hauts-de-France" },
  "81": { name: "Tarn", region: "Occitanie" },
  "82": { name: "Tarn-et-Garonne", region: "Occitanie" },
  "83": { name: "Var", region: "Provence-Alpes-Côte d'Azur" },
  "84": { name: "Vaucluse", region: "Provence-Alpes-Côte d'Azur" },
  "85": { name: "Vendée", region: "Pays de la Loire" },
  "86": { name: "Vienne", region: "Nouvelle-Aquitaine" },
  "87": { name: "Haute-Vienne", region: "Nouvelle-Aquitaine" },
  "88": { name: "Vosges", region: "Grand Est" },
  "89": { name: "Yonne", region: "Bourgogne-Franche-Comté" },
  "90": { name: "Territoire de Belfort", region: "Bourgogne-Franche-Comté" },
  "91": { name: "Essonne", region: "Île-de-France" },
  "92": { name: "Hauts-de-Seine", region: "Île-de-France" },
  "93": { name: "Seine-Saint-Denis", region: "Île-de-France" },
  "94": { name: "Val-de-Marne", region: "Île-de-France" },
  "95": { name: "Val-d'Oise", region: "Île-de-France" },
  // DOM-TOM
  "971": { name: "Guadeloupe", region: "DOM-TOM" },
  "972": { name: "Martinique", region: "DOM-TOM" },
  "973": { name: "Guyane", region: "DOM-TOM" },
  "974": { name: "La Réunion", region: "DOM-TOM" },
  "976": { name: "Mayotte", region: "DOM-TOM" },
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
          Visualisez la répartition des députés et sénateurs par département.
          Cliquez sur un département pour voir les détails.
        </p>
      </div>

      <CarteClient initialDepartments={departments} initialStats={stats} />
    </div>
  );
}
