import { Badge } from "@/components/ui/badge";
import { ElectionCountdown } from "@/components/elections/ElectionCountdown";

interface MunicipalesHeroProps {
  targetDate: string | null; // ISO string for countdown
  dateConfirmed: boolean;
  totalCandidacies: number;
  totalCommunes: number;
  totalLists: number;
}

const headlineStats = (props: MunicipalesHeroProps) => [
  { value: props.totalCandidacies, label: "candidats" },
  { value: props.totalCommunes, label: "communes" },
  { value: props.totalLists, label: "listes" },
];

export function MunicipalesHero({
  targetDate,
  dateConfirmed,
  totalCandidacies,
  totalCommunes,
  totalLists,
}: MunicipalesHeroProps) {
  const stats = headlineStats({
    targetDate,
    dateConfirmed,
    totalCandidacies,
    totalCommunes,
    totalLists,
  });

  return (
    <div className="bg-gradient-to-br from-primary/10 via-background to-accent/10 border rounded-2xl p-6 md:p-8">
      <h1 className="font-display text-3xl md:text-4xl font-bold">Municipales 2026</h1>
      <p className="text-muted-foreground mt-1 mb-6">15-22 mars 2026</p>

      {!dateConfirmed && (
        <div className="mb-4">
          <Badge variant="outline">Dates provisoires</Badge>
        </div>
      )}

      {targetDate && (
        <div className="mb-6">
          <ElectionCountdown
            targetDate={targetDate}
            electionTitle="Municipales 2026"
            electionIcon=""
            dateConfirmed={dateConfirmed}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="tabular-nums text-2xl font-bold">{stat.value.toLocaleString("fr-FR")}</p>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
