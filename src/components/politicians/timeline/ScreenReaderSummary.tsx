import type { SerializedMandate } from "@/types";
import { MANDATE_TYPE_LABELS, AFFAIR_STATUS_LABELS } from "@/config/labels";
import { formatDate } from "@/lib/utils";
import type { TimelineAffair } from "./types";

export function ScreenReaderSummary({
  mandates,
  timelineAffairs,
  minYear,
  maxYear,
}: {
  mandates: SerializedMandate[];
  timelineAffairs: TimelineAffair[];
  minYear: number;
  maxYear: number;
}) {
  return (
    <div className="sr-only">
      <h3>Résumé de la chronologie</h3>
      <p>
        Période : {minYear} à {maxYear}
      </p>
      <h4>Mandats ({mandates.length})</h4>
      <ul>
        {mandates.map((m) => (
          <li key={m.id}>
            {MANDATE_TYPE_LABELS[m.type]}
            {m.constituency && `, ${m.constituency}`} : {new Date(m.startDate).getFullYear()} -{" "}
            {m.isCurrent ? "présent" : m.endDate ? new Date(m.endDate).getFullYear() : ""}
          </li>
        ))}
      </ul>
      {timelineAffairs.length > 0 && (
        <>
          <h4>Affaires ({timelineAffairs.length})</h4>
          <ul>
            {timelineAffairs.map((a) => (
              <li key={a.id}>
                {a.title} : {AFFAIR_STATUS_LABELS[a.status]}, {formatDate(a.date)}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
