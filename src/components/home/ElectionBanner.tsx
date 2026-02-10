import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ELECTION_TYPE_ICONS } from "@/config/labels";
import type { Election } from "@/types";

interface ElectionBannerProps {
  election: Election;
  daysUntil: number | null;
}

export function ElectionBanner({ election, daysUntil }: ElectionBannerProps) {
  const icon = ELECTION_TYPE_ICONS[election.type];

  const seatsLabel = election.totalSeats
    ? `${election.totalSeats.toLocaleString("fr-FR")} conseillers municipaux à élire`
    : null;

  return (
    <section className="py-6">
      <div className="container mx-auto px-4">
        <Link href={`/elections/${election.slug}`} className="block group">
          <div className="relative overflow-hidden rounded-xl border border-indigo-200 dark:border-indigo-800 bg-gradient-to-r from-indigo-50 via-violet-50 to-purple-50 dark:from-indigo-950/50 dark:via-violet-950/50 dark:to-purple-950/50 p-6 md:p-8 transition-shadow group-hover:shadow-lg">
            {/* Left accent border */}
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-indigo-500 to-violet-500 rounded-l-xl" />

            <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 pl-3">
              {/* Icon + text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl" aria-hidden="true">
                    {icon}
                  </span>
                  <h2 className="text-xl md:text-2xl font-bold text-foreground">
                    {election.shortTitle || election.title}
                  </h2>
                  {election.dateConfirmed && (
                    <Badge
                      variant="outline"
                      className="border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 text-xs"
                    >
                      Dates confirmées
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground">
                  {seatsLabel}
                  {seatsLabel && daysUntil != null && " — "}
                  {daysUntil != null && daysUntil > 0 && (
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                      dans {daysUntil} jour{daysUntil > 1 ? "s" : ""}
                    </span>
                  )}
                </p>
              </div>

              {/* CTA */}
              <Button
                variant="default"
                className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 self-start md:self-center"
                tabIndex={-1}
                aria-hidden="true"
              >
                Voir les détails
              </Button>
            </div>

            {/* Decorative circles */}
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-indigo-200/30 dark:bg-indigo-800/20 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-6 right-16 w-20 h-20 bg-violet-200/30 dark:bg-violet-800/20 rounded-full blur-xl pointer-events-none" />
          </div>
        </Link>
      </div>
    </section>
  );
}
