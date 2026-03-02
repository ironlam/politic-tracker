import {
  FACTCHECK_RATING_LABELS,
  VERDICT_GROUPS,
  VERDICT_GROUP_LABELS,
  VERDICT_GROUP_COLORS,
} from "@/config/labels";
import type { FactCheckRating } from "@/types";

interface FactchecksSideData {
  count: number;
  byVerdict: Record<string, number>;
}

interface FactchecksSectionProps {
  left: FactchecksSideData;
  right: FactchecksSideData;
  leftLabel: string;
  rightLabel: string;
}

/** Map individual rating keys to verdict groups for stacked bar rendering. */
function aggregateByGroup(byVerdict: Record<string, number>): Record<string, number> {
  const groups: Record<string, number> = { vrai: 0, trompeur: 0, faux: 0, inverifiable: 0 };
  for (const [rating, count] of Object.entries(byVerdict)) {
    for (const [group, ratings] of Object.entries(VERDICT_GROUPS)) {
      if ((ratings as readonly string[]).includes(rating)) {
        groups[group] = (groups[group] || 0) + count;
        break;
      }
    }
  }
  return groups;
}

export function FactchecksSection({ left, right, leftLabel, rightLabel }: FactchecksSectionProps) {
  if (left.count === 0 && right.count === 0) return null;

  return (
    <section>
      <h3 className="text-lg font-display font-semibold mb-4">Fact-checks</h3>
      <div className="grid md:grid-cols-2 gap-6">
        <FactchecksSide data={left} label={leftLabel} />
        <FactchecksSide data={right} label={rightLabel} />
      </div>
    </section>
  );
}

function FactchecksSide({ data, label }: { data: FactchecksSideData; label: string }) {
  if (data.count === 0) {
    return (
      <div className="bg-muted rounded-lg p-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
        <p className="text-muted-foreground text-sm text-center py-2">Aucune mention</p>
      </div>
    );
  }

  const groups = aggregateByGroup(data.byVerdict);
  const total = Object.values(groups).reduce((s, n) => s + n, 0);
  const activeGroups = Object.entries(groups).filter(([, count]) => count > 0);

  // Also show per-rating breakdown if there are ratings
  const ratingEntries = Object.entries(data.byVerdict).filter(([, count]) => count > 0);

  return (
    <div className="bg-muted rounded-lg p-4">
      <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
      <p className="text-2xl font-bold mb-3">
        {data.count} mention{data.count > 1 ? "s" : ""}
      </p>

      {/* Stacked verdict bar */}
      {total > 0 && (
        <div className="mb-3">
          <div className="flex h-3 rounded-full overflow-hidden">
            {activeGroups.map(([group, count]) => (
              <div
                key={group}
                style={{
                  width: `${(count / total) * 100}%`,
                  backgroundColor: VERDICT_GROUP_COLORS[group],
                }}
                title={`${VERDICT_GROUP_LABELS[group]} : ${count}`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
            {activeGroups.map(([group, count]) => (
              <span key={group} className="flex items-center gap-1 text-xs text-muted-foreground">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ backgroundColor: VERDICT_GROUP_COLORS[group] }}
                />
                {VERDICT_GROUP_LABELS[group]} : {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Per-rating detail */}
      {ratingEntries.length > 0 && (
        <ul className="space-y-1">
          {ratingEntries.map(([rating, count]) => (
            <li key={rating} className="flex items-center justify-between text-sm">
              <span>{FACTCHECK_RATING_LABELS[rating as FactCheckRating] || rating}</span>
              <span className="font-medium">{count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
