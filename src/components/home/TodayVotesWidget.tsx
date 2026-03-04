import Link from "next/link";
import { Vote, CheckCircle, XCircle, ArrowRight } from "lucide-react";

interface TodayVotesWidgetProps {
  total: number;
  adopted: number;
  rejected: number;
}

export function TodayVotesWidget({ total, adopted, rejected }: TodayVotesWidgetProps) {
  if (total === 0) return null;

  return (
    <section className="py-6">
      <div className="container mx-auto px-4">
        <Link
          href="/votes/aujourd-hui"
          className="group flex items-center justify-between gap-4 px-5 py-4 rounded-xl border bg-card hover:bg-accent/40 transition-colors"
          prefetch={false}
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
              <Vote className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div>
              <p className="font-semibold text-sm sm:text-base">
                Votes du jour
                <span className="ml-2 text-muted-foreground font-normal">
                  {total} scrutin{total > 1 ? "s" : ""}
                </span>
              </p>
              <div className="flex items-center gap-3 mt-0.5 text-xs sm:text-sm text-muted-foreground">
                {adopted > 0 && (
                  <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    {adopted} adopté{adopted > 1 ? "s" : ""}
                  </span>
                )}
                {rejected > 0 && (
                  <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                    <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    {rejected} rejeté{rejected > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
          </div>
          <ArrowRight
            className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0"
            aria-hidden="true"
          />
        </Link>
      </div>
    </section>
  );
}
