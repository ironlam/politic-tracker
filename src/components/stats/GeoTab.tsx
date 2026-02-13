import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "./ProgressBar";
import { getColor, TEXT_COLORS } from "@/config/colors";

interface DepartmentStats {
  code: string;
  name: string;
  deputes: number;
  senateurs: number;
  total: number;
}

interface RegionStats {
  name: string;
  total: number;
  deputes: number;
  senateurs: number;
}

interface GeoStatsData {
  totalByType: {
    deputes: number;
    senateurs: number;
    meps: number;
    gouvernement: number;
  };
  topDepartments: DepartmentStats[];
  byRegion: RegionStats[];
}

interface GeoTabProps {
  stats: GeoStatsData;
}

export function GeoTab({ stats }: GeoTabProps) {
  const maxByDepartment = Math.max(...stats.topDepartments.map((d) => d.total), 1);
  const maxByRegion = Math.max(...stats.byRegion.map((r) => r.total), 1);

  return (
    <div>
      {/* Global stats by type */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Députés</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${TEXT_COLORS.chamber.AN}`}>
              {stats.totalByType.deputes}
            </p>
            <p className="text-sm text-muted-foreground">Assemblée nationale</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sénateurs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${TEXT_COLORS.chamber.SENAT}`}>
              {stats.totalByType.senateurs}
            </p>
            <p className="text-sm text-muted-foreground">Sénat</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Eurodéputés</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${TEXT_COLORS.chamber.PE}`}>
              {stats.totalByType.meps}
            </p>
            <p className="text-sm text-muted-foreground">Parlement européen</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Gouvernement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${TEXT_COLORS.chamber.GOUVERNEMENT}`}>
              {stats.totalByType.gouvernement}
            </p>
            <p className="text-sm text-muted-foreground">Membres actuels</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Top departments */}
        <Card>
          <CardHeader>
            <CardTitle>Départements avec le plus d&apos;élus</CardTitle>
            <p className="text-sm text-muted-foreground">Top 15 (députés + sénateurs)</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.topDepartments.map((dept) => (
              <div key={dept.code}>
                <div className="flex justify-between text-sm mb-1">
                  <Link
                    href={`/departements/${dept.code}`}
                    className="hover:underline flex items-center gap-2"
                  >
                    <Badge variant="outline" className="font-mono">
                      {dept.code}
                    </Badge>
                    <span className="truncate">{dept.name}</span>
                  </Link>
                  <span className="font-medium shrink-0 ml-2">{dept.total}</span>
                </div>
                {/* Stacked bar: deputes + senateurs */}
                <div
                  className="w-full h-4 rounded-full overflow-hidden flex bg-muted"
                  role="img"
                  aria-label={`${dept.name} : ${dept.deputes} députés, ${dept.senateurs} sénateurs`}
                >
                  <div
                    className="h-full"
                    style={{
                      width: `${(dept.deputes / dept.total) * (dept.total / maxByDepartment) * 100}%`,
                      backgroundColor: getColor("chamber", "AN", "light"),
                    }}
                    title={`Députés: ${dept.deputes}`}
                  />
                  <div
                    className="h-full"
                    style={{
                      width: `${(dept.senateurs / dept.total) * (dept.total / maxByDepartment) * 100}%`,
                      backgroundColor: getColor("chamber", "SENAT", "light"),
                    }}
                    title={`Sénateurs: ${dept.senateurs}`}
                  />
                </div>
                <div className="flex gap-4 text-xs mt-1">
                  <span className={TEXT_COLORS.chamber.AN}>{dept.deputes} députés</span>
                  <span className={TEXT_COLORS.chamber.SENAT}>{dept.senateurs} sénateurs</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* By region */}
        <Card>
          <CardHeader>
            <CardTitle>Distribution par région</CardTitle>
            <p className="text-sm text-muted-foreground">Nombre d&apos;élus parlementaires</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.byRegion.map((region) => (
              <div key={region.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{region.name}</span>
                  <span className="font-medium">{region.total}</span>
                </div>
                <ProgressBar
                  value={region.total}
                  max={maxByRegion}
                  color="bg-primary"
                  label={`${region.name} : ${region.total} élus`}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Link to map */}
      <div className="mt-8 p-6 bg-muted/50 rounded-xl text-center">
        <h3 className="font-semibold mb-2">Carte interactive</h3>
        <p className="text-muted-foreground mb-4">
          Explorez les élus de chaque département sur notre carte de France
        </p>
        <Link
          href="/carte"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          Voir la carte
        </Link>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-6 mt-6 text-sm">
        <div className="flex items-center gap-2">
          <span
            className="w-4 h-4 rounded"
            style={{ backgroundColor: getColor("chamber", "AN", "light") }}
            aria-hidden="true"
          />
          <span>Assemblée nationale</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="w-4 h-4 rounded"
            style={{ backgroundColor: getColor("chamber", "SENAT", "light") }}
            aria-hidden="true"
          />
          <span>Sénat</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="w-4 h-4 rounded"
            style={{ backgroundColor: getColor("chamber", "PE", "light") }}
            aria-hidden="true"
          />
          <span>Parlement européen</span>
        </div>
      </div>
    </div>
  );
}
