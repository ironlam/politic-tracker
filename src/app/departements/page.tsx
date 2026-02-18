import { Metadata } from "next";
import Link from "next/link";
import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DEPARTMENTS, getDepartmentSlug } from "@/config/departments";

export const metadata: Metadata = {
  title: "Départements",
  description:
    "Liste des départements français et leurs représentants politiques - députés et sénateurs par département.",
};

async function getDepartmentStats() {
  "use cache";
  cacheTag("departments", "politicians");
  cacheLife("minutes");

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
  const departmentList = Object.entries(DEPARTMENTS).map(([code, { name }]) => ({
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
            href={`/departements/${getDepartmentSlug(dept.name)}`}
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
