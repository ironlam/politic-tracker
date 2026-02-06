import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "./ProgressBar";
import { getColor } from "@/config/colors";

interface VoteStats {
  totalVotes: number;
  anVotes: number;
  senatVotes: number;
  adoptes: number;
  rejetes: number;
}

interface PartyVoteStats {
  id: string;
  slug: string | null;
  name: string;
  shortName: string | null;
  color: string | null;
  totalVotes: number;
  pour: number;
  contre: number;
  abstention: number;
}

interface TopScrutin {
  id: string;
  slug: string | null;
  title: string;
  date: Date;
  chamber: string;
  result: string;
  totalPour: number;
  totalContre: number;
  totalAbstention: number;
}

interface VotesTabProps {
  stats: VoteStats;
  byParty: PartyVoteStats[];
  topScrutins: TopScrutin[];
  chamberFilter: "all" | "AN" | "SENAT";
}

export function VotesTab({
  stats,
  byParty,
  topScrutins,
  chamberFilter,
}: VotesTabProps) {
  const maxByParty = Math.max(...byParty.map((p) => p.totalVotes), 1);

  return (
    <div>
      {/* Global stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total scrutins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.totalVotes}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Assemblée nationale
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className="text-3xl font-bold"
              style={{ color: getColor("chamber", "AN", "light") }}
            >
              {stats.anVotes}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sénat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className="text-3xl font-bold"
              style={{ color: getColor("chamber", "SENAT", "light") }}
            >
              {stats.senatVotes}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Adoptés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className="text-3xl font-bold"
              style={{ color: getColor("vote", "pour", "light") }}
            >
              {stats.adoptes}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Rejetés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className="text-3xl font-bold"
              style={{ color: getColor("vote", "contre", "light") }}
            >
              {stats.rejetes}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chamber filter */}
      <div className="flex gap-2 mb-6">
        <Link
          href="/statistiques?tab=votes&chamber=all"
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            chamberFilter === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          }`}
        >
          Toutes
        </Link>
        <Link
          href="/statistiques?tab=votes&chamber=AN"
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            chamberFilter === "AN"
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          }`}
        >
          Assemblée
        </Link>
        <Link
          href="/statistiques?tab=votes&chamber=SENAT"
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            chamberFilter === "SENAT"
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          }`}
        >
          Sénat
        </Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Votes by party */}
        <Card>
          <CardHeader>
            <CardTitle>Distribution par parti</CardTitle>
            <p className="text-sm text-muted-foreground">
              Répartition des votes par groupe politique
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {byParty.slice(0, 10).map((party) => {
              const total = party.pour + party.contre + party.abstention;
              const pourPct = total > 0 ? (party.pour / total) * 100 : 0;
              const contrePct = total > 0 ? (party.contre / total) * 100 : 0;
              const abstPct = total > 0 ? (party.abstention / total) * 100 : 0;

              return (
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
                    <span className="font-medium">{party.totalVotes}</span>
                  </div>
                  {/* Stacked bar */}
                  <div className="w-full h-4 rounded-full overflow-hidden flex bg-muted">
                    <div
                      className="h-full"
                      style={{
                        width: `${pourPct}%`,
                        backgroundColor: getColor("vote", "pour", "light"),
                      }}
                      title={`Pour: ${party.pour}`}
                    />
                    <div
                      className="h-full"
                      style={{
                        width: `${contrePct}%`,
                        backgroundColor: getColor("vote", "contre", "light"),
                      }}
                      title={`Contre: ${party.contre}`}
                    />
                    <div
                      className="h-full"
                      style={{
                        width: `${abstPct}%`,
                        backgroundColor: getColor("vote", "abstention", "light"),
                      }}
                      title={`Abstention: ${party.abstention}`}
                    />
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                    <span style={{ color: getColor("vote", "pour", "light") }}>
                      {pourPct.toFixed(0)}% pour
                    </span>
                    <span style={{ color: getColor("vote", "contre", "light") }}>
                      {contrePct.toFixed(0)}% contre
                    </span>
                    <span
                      style={{ color: getColor("vote", "abstention", "light") }}
                    >
                      {abstPct.toFixed(0)}% abst.
                    </span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Top contested scrutins */}
        <Card>
          <CardHeader>
            <CardTitle>Scrutins les plus disputés</CardTitle>
            <p className="text-sm text-muted-foreground">
              Les votes avec le plus petit écart
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {topScrutins.map((scrutin) => {
              const total =
                scrutin.totalPour +
                scrutin.totalContre +
                scrutin.totalAbstention;
              const pourPct =
                total > 0 ? (scrutin.totalPour / total) * 100 : 0;
              const contrePct =
                total > 0 ? (scrutin.totalContre / total) * 100 : 0;

              return (
                <Link
                  key={scrutin.id}
                  href={`/votes/${scrutin.slug || scrutin.id}`}
                  className="block hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors"
                >
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-sm">
                        {scrutin.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {scrutin.chamber === "AN" ? "Assemblée" : "Sénat"} •{" "}
                        {new Date(scrutin.date).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <Badge
                      variant={
                        scrutin.result === "ADOPTE" ? "default" : "destructive"
                      }
                      className={
                        scrutin.result === "ADOPTE"
                          ? "bg-green-500/10 text-green-600 dark:text-green-400"
                          : ""
                      }
                    >
                      {scrutin.result === "ADOPTE" ? "Adopté" : "Rejeté"}
                    </Badge>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <span style={{ color: getColor("vote", "pour", "light") }}>
                      {scrutin.totalPour} pour ({pourPct.toFixed(0)}%)
                    </span>
                    <span>•</span>
                    <span style={{ color: getColor("vote", "contre", "light") }}>
                      {scrutin.totalContre} contre ({contrePct.toFixed(0)}%)
                    </span>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-6 mt-6 text-sm">
        <div className="flex items-center gap-2">
          <span
            className="w-4 h-4 rounded"
            style={{ backgroundColor: getColor("vote", "pour", "light") }}
          />
          <span>Pour</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="w-4 h-4 rounded"
            style={{ backgroundColor: getColor("vote", "contre", "light") }}
          />
          <span>Contre</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="w-4 h-4 rounded"
            style={{ backgroundColor: getColor("vote", "abstention", "light") }}
          />
          <span>Abstention</span>
        </div>
      </div>
    </div>
  );
}
