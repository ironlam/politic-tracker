import Link from "next/link";
import { CalendarDays, Vote, Newspaper, Scale, ShieldCheck, ArrowRight } from "lucide-react";
import type { WeeklyRecapData } from "@/lib/data/recap";

interface HomeRecapSectionProps {
  data: WeeklyRecapData;
}

const FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "long",
};

function formatWeekRange(start: Date, end: Date): string {
  const fmt = new Intl.DateTimeFormat("fr-FR", FORMAT_OPTIONS);
  const endDisplay = new Date(end);
  endDisplay.setDate(endDisplay.getDate() - 1); // end is exclusive (Monday), show Sunday
  return `Semaine du ${fmt.format(start)} au ${fmt.format(endDisplay)}`;
}

export function HomeRecapSection({ data }: HomeRecapSectionProps) {
  const totalActivity =
    data.votes.total + data.press.articleCount + data.affairs.total + data.factChecks.total;

  // Don't show if the week had zero activity
  if (totalActivity === 0) return null;

  const kpis = [
    {
      icon: Vote,
      value: data.votes.total,
      label: "scrutins",
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      icon: Newspaper,
      value: data.press.articleCount,
      label: "articles presse",
      color: "text-green-600 dark:text-green-400",
      bg: "bg-green-100 dark:bg-green-900/30",
    },
    {
      icon: Scale,
      value: data.affairs.total,
      label: "affaires",
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-100 dark:bg-amber-900/30",
    },
    {
      icon: ShieldCheck,
      value: data.factChecks.total,
      label: "fact-checks",
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-100 dark:bg-red-900/30",
    },
  ];

  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CalendarDays className="h-5 w-5 text-primary" aria-hidden="true" />
              <h2 className="text-2xl md:text-3xl font-display font-bold">Le Recap</h2>
            </div>
            <p className="text-muted-foreground">{formatWeekRange(data.weekStart, data.weekEnd)}</p>
          </div>
          <Link
            href="/recap"
            className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            prefetch={false}
          >
            Voir le recap complet
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div
                key={kpi.label}
                className="flex items-center gap-3 px-4 py-4 rounded-xl border bg-card"
              >
                <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${kpi.bg}`}>
                  <Icon className={`h-5 w-5 ${kpi.color}`} aria-hidden="true" />
                </div>
                <div>
                  <p className="text-2xl font-display font-bold tabular-nums">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile CTA */}
        <Link
          href="/recap"
          className="sm:hidden flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-primary/20 text-primary font-medium hover:bg-primary/5 transition-colors"
          prefetch={false}
        >
          Lire le recap complet
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
