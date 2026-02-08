import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "./ProgressBar";
import { getColor } from "@/config/colors";

interface PressStats {
  totalArticles: number;
  bySource: { source: string; count: number }[];
  lastWeek: number;
  lastMonth: number;
}

interface PoliticianMention {
  id: string;
  slug: string;
  fullName: string;
  party: { shortName: string | null; color: string | null } | null;
  mentionCount: number;
}

interface PartyMention {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  color: string | null;
  mentionCount: number;
}

interface PressTabProps {
  stats: PressStats;
  topPoliticians: PoliticianMention[];
  topParties: PartyMention[];
}

const sourceLabels: Record<string, string> = {
  LEMONDE: "Le Monde",
  POLITICO: "Politico",
  MEDIAPART: "Mediapart",
};

export function PressTab({ stats, topPoliticians, topParties }: PressTabProps) {
  const maxByPolitician = Math.max(...topPoliticians.map((p) => p.mentionCount), 1);
  const maxByParty = Math.max(...topParties.map((p) => p.mentionCount), 1);
  const maxBySource = Math.max(...stats.bySource.map((s) => s.count), 1);

  return (
    <div>
      {/* Global stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total articles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.totalArticles}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cette semaine
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{stats.lastWeek}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ce mois</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.lastMonth}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.bySource.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Articles by source */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Répartition par source</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stats.bySource.map(({ source, count }) => (
            <div key={source}>
              <div className="flex justify-between text-sm mb-1">
                <Badge variant="outline">{sourceLabels[source] || source}</Badge>
                <span className="font-medium">{count}</span>
              </div>
              <ProgressBar
                value={count}
                max={maxBySource}
                hexColor={getColor("press", source.toLowerCase(), "light")}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Top politicians mentioned */}
        <Card>
          <CardHeader>
            <CardTitle>Politiques les plus cités</CardTitle>
            <p className="text-sm text-muted-foreground">Top 10 des mentions dans la presse</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {topPoliticians.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucune mention indexée</p>
            ) : (
              topPoliticians.map((politician) => (
                <div key={politician.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <Link
                      href={`/politiques/${politician.slug}`}
                      className="hover:underline flex items-center gap-2 truncate"
                    >
                      <span className="truncate">{politician.fullName}</span>
                      {politician.party && (
                        <Badge
                          variant="outline"
                          className="text-xs shrink-0"
                          style={{
                            borderColor: politician.party.color || undefined,
                            color: politician.party.color || undefined,
                          }}
                        >
                          {politician.party.shortName}
                        </Badge>
                      )}
                    </Link>
                    <span className="font-medium shrink-0 ml-2">{politician.mentionCount}</span>
                  </div>
                  <ProgressBar
                    value={politician.mentionCount}
                    max={maxByPolitician}
                    color="bg-primary"
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Top parties mentioned */}
        <Card>
          <CardHeader>
            <CardTitle>Partis les plus cités</CardTitle>
            <p className="text-sm text-muted-foreground">Top 5 des mentions dans la presse</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {topParties.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucune mention indexée</p>
            ) : (
              topParties.map((party) => (
                <div key={party.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <Link
                      href={`/partis/${party.slug}`}
                      className="hover:underline flex items-center gap-2"
                    >
                      {party.color && (
                        <span
                          className="w-3 h-3 rounded-full inline-block shrink-0"
                          style={{ backgroundColor: party.color }}
                        />
                      )}
                      <span>{party.shortName || party.name}</span>
                    </Link>
                    <span className="font-medium">{party.mentionCount}</span>
                  </div>
                  <ProgressBar
                    value={party.mentionCount}
                    max={maxByParty}
                    hexColor={party.color || undefined}
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Link to press page */}
      <div className="mt-6 text-center">
        <Link href="/presse" className="text-primary hover:underline text-sm font-medium">
          Voir tous les articles de presse &rarr;
        </Link>
      </div>
    </div>
  );
}
