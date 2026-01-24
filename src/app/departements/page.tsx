import { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Départements",
  description:
    "Liste des départements français et leurs représentants politiques - députés et sénateurs par département.",
};

// French departments with their codes
const DEPARTMENTS: Record<string, string> = {
  "01": "Ain",
  "02": "Aisne",
  "03": "Allier",
  "04": "Alpes-de-Haute-Provence",
  "05": "Hautes-Alpes",
  "06": "Alpes-Maritimes",
  "07": "Ardèche",
  "08": "Ardennes",
  "09": "Ariège",
  "10": "Aube",
  "11": "Aude",
  "12": "Aveyron",
  "13": "Bouches-du-Rhône",
  "14": "Calvados",
  "15": "Cantal",
  "16": "Charente",
  "17": "Charente-Maritime",
  "18": "Cher",
  "19": "Corrèze",
  "21": "Côte-d'Or",
  "22": "Côtes-d'Armor",
  "23": "Creuse",
  "24": "Dordogne",
  "25": "Doubs",
  "26": "Drôme",
  "27": "Eure",
  "28": "Eure-et-Loir",
  "29": "Finistère",
  "2A": "Corse-du-Sud",
  "2B": "Haute-Corse",
  "30": "Gard",
  "31": "Haute-Garonne",
  "32": "Gers",
  "33": "Gironde",
  "34": "Hérault",
  "35": "Ille-et-Vilaine",
  "36": "Indre",
  "37": "Indre-et-Loire",
  "38": "Isère",
  "39": "Jura",
  "40": "Landes",
  "41": "Loir-et-Cher",
  "42": "Loire",
  "43": "Haute-Loire",
  "44": "Loire-Atlantique",
  "45": "Loiret",
  "46": "Lot",
  "47": "Lot-et-Garonne",
  "48": "Lozère",
  "49": "Maine-et-Loire",
  "50": "Manche",
  "51": "Marne",
  "52": "Haute-Marne",
  "53": "Mayenne",
  "54": "Meurthe-et-Moselle",
  "55": "Meuse",
  "56": "Morbihan",
  "57": "Moselle",
  "58": "Nièvre",
  "59": "Nord",
  "60": "Oise",
  "61": "Orne",
  "62": "Pas-de-Calais",
  "63": "Puy-de-Dôme",
  "64": "Pyrénées-Atlantiques",
  "65": "Hautes-Pyrénées",
  "66": "Pyrénées-Orientales",
  "67": "Bas-Rhin",
  "68": "Haut-Rhin",
  "69": "Rhône",
  "70": "Haute-Saône",
  "71": "Saône-et-Loire",
  "72": "Sarthe",
  "73": "Savoie",
  "74": "Haute-Savoie",
  "75": "Paris",
  "76": "Seine-Maritime",
  "77": "Seine-et-Marne",
  "78": "Yvelines",
  "79": "Deux-Sèvres",
  "80": "Somme",
  "81": "Tarn",
  "82": "Tarn-et-Garonne",
  "83": "Var",
  "84": "Vaucluse",
  "85": "Vendée",
  "86": "Vienne",
  "87": "Haute-Vienne",
  "88": "Vosges",
  "89": "Yonne",
  "90": "Territoire de Belfort",
  "91": "Essonne",
  "92": "Hauts-de-Seine",
  "93": "Seine-Saint-Denis",
  "94": "Val-de-Marne",
  "95": "Val-d'Oise",
  "971": "Guadeloupe",
  "972": "Martinique",
  "973": "Guyane",
  "974": "La Réunion",
  "976": "Mayotte",
};

async function getDepartmentStats() {
  // Get counts of deputies per department
  const mandates = await db.mandate.findMany({
    where: {
      type: { in: ["DEPUTE", "SENATEUR"] },
      isCurrent: true,
      constituency: { not: null },
    },
    select: {
      type: true,
      constituency: true,
    },
  });

  // Count by department name
  const stats: Record<string, { deputes: number; senateurs: number }> = {};

  for (const mandate of mandates) {
    if (!mandate.constituency) continue;

    // Extract department name from "Département (X)"
    const match = mandate.constituency.match(/^([^(]+)/);
    if (!match) continue;

    const deptName = match[1].trim();

    if (!stats[deptName]) {
      stats[deptName] = { deputes: 0, senateurs: 0 };
    }

    if (mandate.type === "DEPUTE") {
      stats[deptName].deputes++;
    } else if (mandate.type === "SENATEUR") {
      stats[deptName].senateurs++;
    }
  }

  return stats;
}

export default async function DepartementsPage() {
  const stats = await getDepartmentStats();

  // Group departments by region (simplified: by first letter for now)
  const departmentList = Object.entries(DEPARTMENTS).map(([code, name]) => ({
    code,
    name,
    deputes: stats[name]?.deputes || 0,
    senateurs: stats[name]?.senateurs || 0,
    total: (stats[name]?.deputes || 0) + (stats[name]?.senateurs || 0),
  }));

  // Sort by name
  departmentList.sort((a, b) => a.name.localeCompare(b.name, "fr"));

  // Calculate totals
  const totalDeputes = departmentList.reduce((acc, d) => acc + d.deputes, 0);
  const totalSenateurs = departmentList.reduce((acc, d) => acc + d.senateurs, 0);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Départements</h1>
        <p className="text-muted-foreground">
          {departmentList.length} départements · {totalDeputes} députés · {totalSenateurs} sénateurs
        </p>
      </div>

      {/* Quick search hint */}
      <div className="mb-6 p-4 bg-muted rounded-lg">
        <p className="text-sm">
          Vous cherchez votre député ?{" "}
          <Link href="/mon-depute" className="text-primary hover:underline font-medium">
            Utilisez la recherche par code postal →
          </Link>
        </p>
      </div>

      {/* Grid of departments */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {departmentList.map((dept) => (
          <Link
            key={dept.code}
            href={`/departements/${encodeURIComponent(dept.name)}`}
            className="block group"
          >
            <Card className="h-full transition-all duration-200 hover:shadow-lg hover:border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold group-hover:text-primary transition-colors truncate">
                      {dept.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{dept.code}</p>
                  </div>
                  {dept.total > 0 && (
                    <div className="flex gap-1 shrink-0">
                      {dept.deputes > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {dept.deputes} dép.
                        </Badge>
                      )}
                      {dept.senateurs > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {dept.senateurs} sén.
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
