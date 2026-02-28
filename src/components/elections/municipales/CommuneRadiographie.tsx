import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CommuneRadiographieProps {
  listCount: number;
  candidateCount: number;
  population: number | null;
  totalSeats: number | null;
  femaleRate: number;
  nationalPoliticiansCount: number;
}

function getCompetitionInfo(
  listCount: number,
  population: number | null
): { label: string; className: string } {
  // Expected number of lists based on population
  let expectedLists = 2;
  if (population != null) {
    if (population >= 50_000) expectedLists = 4;
    else if (population >= 10_000) expectedLists = 3;
  }

  const ratio = expectedLists > 0 ? listCount / expectedLists : 0;

  if (ratio > 1) {
    return { label: "Forte", className: "bg-green-100 text-green-800" };
  }
  if (ratio >= 0.5) {
    return { label: "Normale", className: "bg-yellow-100 text-yellow-800" };
  }
  return { label: "Faible", className: "bg-red-100 text-red-800" };
}

function getParityInfo(femaleRate: number): {
  label: string;
  className: string;
} {
  const pct = Math.round(femaleRate * 100);
  if (pct >= 45) {
    return { label: `${pct} %`, className: "text-green-700" };
  }
  if (pct >= 30) {
    return { label: `${pct} %`, className: "text-yellow-700" };
  }
  return { label: `${pct} %`, className: "text-red-700" };
}

export function CommuneRadiographie({
  listCount,
  candidateCount,
  population,
  totalSeats,
  femaleRate,
  nationalPoliticiansCount,
}: CommuneRadiographieProps) {
  const competition = getCompetitionInfo(listCount, population);
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
            <dt className="text-muted-foreground text-sm">Competition</dt>
            <dd className="mt-1">
              <Badge className={competition.className}>{competition.label}</Badge>
            </dd>
          </div>

          {/* Parity */}
          <div>
            <dt className="text-muted-foreground text-sm">Parite F/H</dt>
            <dd className={`text-2xl md:text-3xl font-bold tabular-nums ${parity.className}`}>
              {parity.label}
            </dd>
          </div>

          {/* Seats */}
          {totalSeats != null && (
            <div>
              <dt className="text-muted-foreground text-sm">Sieges a pourvoir</dt>
              <dd className="text-2xl md:text-3xl font-bold tabular-nums">{totalSeats}</dd>
            </div>
          )}

          {/* National politicians */}
          {nationalPoliticiansCount > 0 && (
            <div>
              <dt className="text-muted-foreground text-sm">Personnalites nationales</dt>
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
