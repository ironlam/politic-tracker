import { Badge } from "@/components/ui/badge";

/**
 * "Fiche PoliGraph" badge — shown on candidate/mayor cards
 * when we have a linked politician profile with cross-referenced data.
 */
export function PoligraphBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={className ?? "shrink-0 text-xs"}
      title="Fiche avec toutes les informations croisées du représentant"
    >
      Fiche PoliGraph
    </Badge>
  );
}

/**
 * Small legend explaining the PoliGraph badge.
 * Place near candidate/mayor sections.
 */
export function PoligraphBadgeLegend() {
  return (
    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
      <Badge variant="outline" className="text-xs pointer-events-none">
        Fiche PoliGraph
      </Badge>
      = profil avec informations croisées (mandats, votes, patrimoine, affaires…)
    </p>
  );
}
