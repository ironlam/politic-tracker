import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { ElectionStatus } from "@/types";

interface KeyDate {
  label: string;
  date: Date;
  provisional: boolean;
}

interface ElectionKeyDatesProps {
  registrationDeadline: Date | null;
  candidacyOpenDate: Date | null;
  candidacyDeadline: Date | null;
  campaignStartDate: Date | null;
  round1Date: Date | null;
  round2Date: Date | null;
  dateConfirmed: boolean;
  status: ElectionStatus;
}

const STATUS_ORDER: ElectionStatus[] = [
  "UPCOMING",
  "REGISTRATION",
  "CANDIDACIES",
  "CAMPAIGN",
  "ROUND_1",
  "BETWEEN_ROUNDS",
  "ROUND_2",
  "COMPLETED",
];

function getPhaseForDate(label: string): ElectionStatus {
  switch (label) {
    case "Date limite d'inscription":
      return "REGISTRATION";
    case "Ouverture des candidatures":
    case "Clôture des candidatures":
      return "CANDIDACIES";
    case "Début de campagne":
      return "CAMPAIGN";
    case "1er tour":
      return "ROUND_1";
    case "2nd tour":
      return "ROUND_2";
    default:
      return "UPCOMING";
  }
}

function getDateStatus(
  datePhase: ElectionStatus,
  currentStatus: ElectionStatus
): "past" | "current" | "future" {
  const dateIdx = STATUS_ORDER.indexOf(datePhase);
  const currentIdx = STATUS_ORDER.indexOf(currentStatus);

  if (dateIdx < currentIdx) return "past";
  if (dateIdx === currentIdx) return "current";
  return "future";
}

export function ElectionKeyDates({
  registrationDeadline,
  candidacyOpenDate,
  candidacyDeadline,
  campaignStartDate,
  round1Date,
  round2Date,
  dateConfirmed,
  status,
}: ElectionKeyDatesProps) {
  // Build list of non-null dates
  const dates: KeyDate[] = [];

  if (registrationDeadline)
    dates.push({
      label: "Date limite d'inscription",
      date: registrationDeadline,
      provisional: !dateConfirmed,
    });
  if (candidacyOpenDate)
    dates.push({
      label: "Ouverture des candidatures",
      date: candidacyOpenDate,
      provisional: !dateConfirmed,
    });
  if (candidacyDeadline)
    dates.push({
      label: "Clôture des candidatures",
      date: candidacyDeadline,
      provisional: !dateConfirmed,
    });
  if (campaignStartDate)
    dates.push({
      label: "Début de campagne",
      date: campaignStartDate,
      provisional: !dateConfirmed,
    });
  if (round1Date)
    dates.push({
      label: "1er tour",
      date: round1Date,
      provisional: !dateConfirmed,
    });
  if (round2Date)
    dates.push({
      label: "2nd tour",
      date: round2Date,
      provisional: !dateConfirmed,
    });

  if (dates.length === 0) return null;

  return (
    <section aria-label="Dates clés">
      <h2 className="text-lg font-semibold mb-4">Dates clés</h2>
      <ol className="relative border-l-2 border-muted ml-3 space-y-6">
        {dates.map((d, i) => {
          const phase = getPhaseForDate(d.label);
          const dateStatus = getDateStatus(phase, status);

          const dotColor =
            dateStatus === "past"
              ? "bg-green-500"
              : dateStatus === "current"
                ? "bg-blue-500 ring-4 ring-blue-500/20"
                : "bg-muted-foreground/30";

          return (
            <li key={i} className="ml-6">
              <span
                className={`absolute -left-[9px] w-4 h-4 rounded-full ${dotColor}`}
                aria-hidden="true"
              />
              <p className="text-sm font-medium">{d.label}</p>
              <p className="text-sm text-muted-foreground">
                {formatDate(d.date)}
                {d.provisional && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    provisoire
                  </Badge>
                )}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
