import { ElectionCard } from "./ElectionCard";
import { ELECTION_TYPE_ICONS } from "@/config/labels";
import type { Election } from "@/types";

interface ElectionTimelineProps {
  elections: Election[];
}

export function ElectionTimeline({ elections }: ElectionTimelineProps) {
  // Split elections with/without dates
  const withDates = elections.filter((e) => e.round1Date !== null);
  const withoutDates = elections.filter((e) => e.round1Date === null);

  // Pre-compute which elections start a new year section
  const yearStarts = new Set<string>();
  const seenYears = new Set<number>();
  for (const election of withDates) {
    const year = election.round1Date!.getFullYear();
    if (!seenYears.has(year)) {
      seenYears.add(year);
      yearStarts.add(election.id);
    }
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" aria-hidden="true" />

      <ol className="space-y-6">
        {withDates.map((election) => {
          const year = election.round1Date!.getFullYear();
          const showYearSeparator = yearStarts.has(election.id);

          return (
            <li key={election.id}>
              {/* Year separator */}
              {showYearSeparator && (
                <div className="relative flex items-center mb-4">
                  <div className="absolute left-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-[10px] font-bold text-primary-foreground">
                      {String(year).slice(-2)}
                    </span>
                  </div>
                  <span className="pl-12 text-sm font-semibold text-muted-foreground">{year}</span>
                </div>
              )}

              {/* Election entry */}
              <div className="relative flex items-start">
                <div className="absolute left-2 w-4 h-4 rounded-full border-2 border-primary bg-background flex items-center justify-center mt-1">
                  <span className="text-[8px]" aria-hidden="true">
                    {ELECTION_TYPE_ICONS[election.type]}
                  </span>
                </div>
                <div className="pl-12 w-full">
                  <ElectionCard
                    slug={election.slug}
                    type={election.type}
                    title={election.title}
                    shortTitle={election.shortTitle}
                    round1Date={election.round1Date}
                    round2Date={election.round2Date}
                    scope={election.scope}
                    totalSeats={election.totalSeats}
                    suffrage={election.suffrage}
                    status={election.status}
                    dateConfirmed={election.dateConfirmed}
                    description={election.description}
                  />
                </div>
              </div>
            </li>
          );
        })}

        {/* Elections without dates */}
        {withoutDates.length > 0 && (
          <li>
            <div className="relative flex items-center mb-4">
              <div className="absolute left-1.5 w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                <span className="text-[10px] font-bold text-muted-foreground">?</span>
              </div>
              <span className="pl-12 text-sm font-semibold text-muted-foreground">
                Dates à confirmer
              </span>
            </div>
            <div className="space-y-4">
              {withoutDates.map((election) => (
                <div key={election.id} className="relative flex items-start">
                  <div className="absolute left-2 w-4 h-4 rounded-full border-2 border-muted bg-background flex items-center justify-center mt-1">
                    <span className="text-[8px]" aria-hidden="true">
                      {ELECTION_TYPE_ICONS[election.type]}
                    </span>
                  </div>
                  <div className="pl-12 w-full">
                    <ElectionCard
                      slug={election.slug}
                      type={election.type}
                      title={election.title}
                      shortTitle={election.shortTitle}
                      round1Date={election.round1Date}
                      round2Date={election.round2Date}
                      scope={election.scope}
                      totalSeats={election.totalSeats}
                      suffrage={election.suffrage}
                      status={election.status}
                      dateConfirmed={election.dateConfirmed}
                      description={election.description}
                    />
                  </div>
                </div>
              ))}
            </div>
          </li>
        )}
      </ol>
    </div>
  );
}
