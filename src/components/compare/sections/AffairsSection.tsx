import {
  AFFAIR_STATUS_LABELS,
  AFFAIR_SEVERITY_LABELS,
  AFFAIR_SEVERITY_COLORS,
} from "@/config/labels";
import type { AffairStatus, AffairSeverity } from "@/types";

interface AffairsSideData {
  count: number;
  byStatus: Record<string, number>;
  bySeverity: Record<string, number>;
}

interface AffairsSectionProps {
  left: AffairsSideData;
  right: AffairsSideData;
  leftLabel: string;
  rightLabel: string;
}

export function AffairsSection({ left, right, leftLabel, rightLabel }: AffairsSectionProps) {
  if (left.count === 0 && right.count === 0) return null;

  return (
    <section>
      <h3 className="text-lg font-display font-semibold mb-4">Affaires judiciaires</h3>
      <div className="grid md:grid-cols-2 gap-6">
        <AffairsSide data={left} label={leftLabel} />
        <AffairsSide data={right} label={rightLabel} />
      </div>
    </section>
  );
}

function AffairsSide({ data, label }: { data: AffairsSideData; label: string }) {
  if (data.count === 0) {
    return (
      <div className="bg-muted rounded-lg p-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
        <p className="text-muted-foreground text-sm text-center py-2">Aucune affaire judiciaire</p>
      </div>
    );
  }

  const statusEntries = Object.entries(data.byStatus).filter(([, count]) => count > 0);
  const severityEntries = Object.entries(data.bySeverity).filter(([, count]) => count > 0);

  return (
    <div className="bg-muted rounded-lg p-4">
      <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
      <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mb-3">
        {data.count} affaire{data.count > 1 ? "s" : ""}
      </p>

      {/* Severity breakdown */}
      {severityEntries.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Par gravité</p>
          <div className="flex flex-wrap gap-1.5">
            {severityEntries.map(([severity, count]) => (
              <span
                key={severity}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${AFFAIR_SEVERITY_COLORS[severity as AffairSeverity] || ""}`}
              >
                {AFFAIR_SEVERITY_LABELS[severity as AffairSeverity] || severity}
                <span className="font-bold">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Status breakdown */}
      {statusEntries.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Par statut</p>
          <ul className="space-y-1">
            {statusEntries.map(([status, count]) => (
              <li key={status} className="flex items-center justify-between text-sm">
                <span className="text-amber-600 dark:text-amber-400">
                  {AFFAIR_STATUS_LABELS[status as AffairStatus] || status}
                </span>
                <span className="font-medium">{count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
