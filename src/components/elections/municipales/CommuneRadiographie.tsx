import { Card, CardContent } from "@/components/ui/card";
import { CompetitionIndex } from "./CompetitionIndex";

interface CommuneRadiographieProps {
  listCount: number;
  candidateCount: number;
  population: number | null;
  totalSeats: number | null;
  femaleRate: number;
  nationalPoliticiansCount: number;
}

function getParityInfo(femaleRate: number): {
  label: string;
  className: string;
} {
  const pct = Math.round(femaleRate * 100);
  if (pct >= 45) {
    return { label: `${pct} %`, className: "text-green-600 dark:text-green-400" };
  }
  if (pct >= 30) {
    return { label: `${pct} %`, className: "text-yellow-600 dark:text-yellow-400" };
  }
  return { label: `${pct} %`, className: "text-red-600 dark:text-red-400" };
}

export function CommuneRadiographie({
  listCount,
  candidateCount,
  population,
  totalSeats,
  femaleRate,
  nationalPoliticiansCount,
}: CommuneRadiographieProps) {
  const parity = getParityInfo(femaleRate);

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="text-lg font-semibold mb-4">Radiographie</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {/* List count */}
          <div>
            <dt className="text-muted-foreground text-sm">Listes</dt>
            <dd className="text-2xl md:text-3xl font-bold tabular-nums">{listCount}</dd>
          </div>

          {/* Candidate count */}
          <div>
            <dt className="text-muted-foreground text-sm">Candidats</dt>
            <dd className="text-2xl md:text-3xl font-bold tabular-nums">{candidateCount}</dd>
          </div>

          {/* Competition */}
          <div>
            <dt className="text-muted-foreground text-sm">Compétition</dt>
            <dd className="mt-1">
              <CompetitionIndex listCount={listCount} population={population} />
            </dd>
          </div>

          {/* Parity */}
          <div>
            <dt className="text-muted-foreground text-sm">Parité F/H</dt>
            <dd className={`text-2xl md:text-3xl font-bold tabular-nums ${parity.className}`}>
              {parity.label}
            </dd>
          </div>

          {/* Seats */}
          {totalSeats != null && (
            <div>
              <dt className="text-muted-foreground text-sm">Sièges à pourvoir</dt>
              <dd className="text-2xl md:text-3xl font-bold tabular-nums">{totalSeats}</dd>
            </div>
          )}

          {/* National politicians */}
          {nationalPoliticiansCount > 0 && (
            <div>
              <dt className="text-muted-foreground text-sm">Personnalités nationales</dt>
              <dd className="text-2xl md:text-3xl font-bold tabular-nums">
                {nationalPoliticiansCount}
              </dd>
            </div>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}
