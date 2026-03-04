import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DateNavigationProps {
  prevDate: string | null;
  nextDate: string | null;
  currentDate: string;
  isToday?: boolean;
}

function formatDateFr(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00Z");
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function DateNavigation({ prevDate, nextDate, currentDate, isToday }: DateNavigationProps) {
  const formatted = formatDateFr(currentDate);

  return (
    <div className="flex items-center justify-between gap-2 sm:gap-4">
      {prevDate ? (
        <Link
          href={`/votes/${prevDate}`}
          className="flex items-center gap-1 px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors"
          prefetch={false}
          aria-label={`Votes du ${formatDateFr(prevDate)}`}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">{formatDateFr(prevDate)}</span>
          <span className="sm:hidden">Précédent</span>
        </Link>
      ) : (
        <div className="px-3 py-2 text-sm text-muted-foreground/30">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </div>
      )}

      <div className="text-center">
        <p className="text-sm sm:text-base font-semibold">
          {isToday && (
            <span className="inline-flex items-center gap-1.5 mr-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              Aujourd&apos;hui
            </span>
          )}
          <span className={isToday ? "text-muted-foreground" : ""}>{formatted}</span>
        </p>
      </div>

      {nextDate ? (
        <Link
          href={`/votes/${nextDate}`}
          className="flex items-center gap-1 px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors"
          prefetch={false}
          aria-label={`Votes du ${formatDateFr(nextDate)}`}
        >
          <span className="hidden sm:inline">{formatDateFr(nextDate)}</span>
          <span className="sm:hidden">Suivant</span>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      ) : (
        <div className="px-3 py-2 text-sm text-muted-foreground/30">
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
