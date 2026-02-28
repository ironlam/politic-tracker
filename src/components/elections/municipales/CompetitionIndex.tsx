import { Badge } from "@/components/ui/badge";

interface CompetitionIndexProps {
  listCount: number;
  population: number | null;
  showLabel?: boolean;
}

function getExpectedLists(population: number | null): number {
  if (population == null) return 2;
  if (population >= 50_000) return 4;
  if (population >= 10_000) return 3;
  return 2;
}

function getCompetitionLevel(
  listCount: number,
  population: number | null
): {
  label: string;
  className: string;
  score: number;
} {
  const expected = getExpectedLists(population);
  const score = expected > 0 ? listCount / expected : 0;

  if (score > 1.0) {
    return {
      label: "Forte",
      className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      score,
    };
  }
  if (score >= 0.5) {
    return {
      label: "Normale",
      className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
      score,
    };
  }
  return {
    label: "Faible",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    score,
  };
}

export function CompetitionIndex({
  listCount,
  population,
  showLabel = false,
}: CompetitionIndexProps) {
  const { label, className } = getCompetitionLevel(listCount, population);

  return <Badge className={className}>{showLabel ? `Compétition : ${label}` : label}</Badge>;
}
