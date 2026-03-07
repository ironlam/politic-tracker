import type { MandateType, AffairStatus } from "@/types";
import { MANDATE_TYPE_COLORS, AFFAIR_STATUS_MARKER_COLORS } from "@/config/timeline";

const LEGEND_MANDATES: { type: MandateType; label: string }[] = [
  { type: "PRESIDENT_REPUBLIQUE", label: "Exécutif" },
  { type: "DEPUTE", label: "Député" },
  { type: "SENATEUR", label: "Sénateur" },
  { type: "MAIRE", label: "Maire" },
  { type: "PRESIDENT_PARTI", label: "Dirigeant de parti" },
];

const LEGEND_AFFAIRS: { status: AffairStatus; label: string }[] = [
  { status: "CONDAMNATION_DEFINITIVE", label: "Condamnation" },
  { status: "PROCES_EN_COURS", label: "Procédure en cours" },
  { status: "RELAXE", label: "Relaxe" },
];

export function TimelineLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground pt-2 border-t border-muted-foreground/10">
      {/* Mandate type colors */}
      {LEGEND_MANDATES.map(({ type, label }) => (
        <div key={type} className="flex items-center gap-1.5">
          <span
            className="w-3 h-2 rounded-sm inline-block"
            style={{ backgroundColor: MANDATE_TYPE_COLORS[type] }}
          />
          <span>{label}</span>
        </div>
      ))}

      {/* Separator */}
      <span className="text-muted-foreground/30">|</span>

      {/* Affair status markers */}
      {LEGEND_AFFAIRS.map(({ status, label }) => (
        <div key={status} className="flex items-center gap-1.5">
          <span
            className="w-3 h-3 inline-block"
            style={{
              backgroundColor: AFFAIR_STATUS_MARKER_COLORS[status],
              clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
            }}
          />
          <span>{label}</span>
        </div>
      ))}

      {/* Separator */}
      <span className="text-muted-foreground/30">|</span>

      {/* Current mandate indicator */}
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse inline-block" />
        <span>Mandat en cours</span>
      </div>
    </div>
  );
}
