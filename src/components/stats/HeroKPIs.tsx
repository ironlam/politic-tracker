import { Card, CardContent } from "@/components/ui/card";

interface HeroKPIsProps {
  scrutins: number;
  affaires: number;
  factChecks: number;
  partis: number;
}

const KPI_CONFIG = [
  { key: "scrutins" as const, label: "Scrutins analysés", icon: "🗳️" },
  { key: "affaires" as const, label: "Affaires documentées", icon: "⚖️" },
  { key: "factChecks" as const, label: "Fact-checks vérifiés", icon: "🔍" },
  { key: "partis" as const, label: "Partis couverts", icon: "🏛️" },
] as const;

export function HeroKPIs(props: HeroKPIsProps) {
  return (
    <section aria-labelledby="stats-heading">
      <h1 id="stats-heading" className="text-3xl font-bold mb-2">
        Statistiques
      </h1>
      <p className="text-muted-foreground mb-8">
        Vue d&apos;ensemble des données sur la vie politique française
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {KPI_CONFIG.map(({ key, label, icon }) => (
          <Card key={key}>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold tabular-nums">
                {props[key].toLocaleString("fr-FR")}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                <span className="mr-1" aria-hidden="true">
                  {icon}
                </span>
                {label}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground px-1">
        Données issues de sources publiques (Assemblée nationale, Sénat, Wikidata, presse). Notre
        couverture n&apos;est pas exhaustive et ne prétend pas à la représentativité statistique.
      </p>
    </section>
  );
}
