import Link from "next/link";
import { VoteCard } from "./VoteCard";
import { DateNavigation } from "./DateNavigation";
import { BreadcrumbJsonLd, CollectionPageJsonLd } from "@/components/seo/JsonLd";
import { getScrutinsByDate, getAdjacentVoteDates } from "@/lib/data/votes";
import { CHAMBER_LABELS } from "@/config/labels";
import { SITE_URL } from "@/config/site";
import { Vote, CheckCircle, XCircle, Building2, ArrowRight, Sparkles } from "lucide-react";
import type { Chamber } from "@/generated/prisma";
import type { DailyScrutin } from "@/lib/data/votes";

interface DailyVotesPageProps {
  date: string;
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

export async function DailyVotesPage({ date, isToday }: DailyVotesPageProps) {
  const [data, adjacent] = await Promise.all([getScrutinsByDate(date), getAdjacentVoteDates(date)]);

  const formatted = formatDateFr(date);
  const title = isToday ? "Votes du jour" : `Votes du ${formatted}`;
  const canonicalPath = isToday ? "/votes/aujourd-hui" : `/votes/${date}`;

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Accueil", url: SITE_URL },
          { name: "Votes", url: `${SITE_URL}/votes` },
          { name: title, url: `${SITE_URL}${canonicalPath}` },
        ]}
      />
      {data.total > 0 && (
        <CollectionPageJsonLd
          name={`Votes parlementaires du ${formatted}`}
          description={`${data.total} scrutins de l'Assemblée nationale et du Sénat du ${formatted}`}
          url={`${SITE_URL}${canonicalPath}`}
          numberOfItems={data.total}
        />
      )}

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Link href="/votes" className="hover:text-foreground transition-colors">
              Votes
            </Link>
            <span>/</span>
            <span>{isToday ? "Aujourd'hui" : formatted}</span>
          </div>

          <h1 className="text-3xl font-display font-extrabold tracking-tight mb-4">{title}</h1>

          <DateNavigation
            prevDate={adjacent.prevDate}
            nextDate={adjacent.nextDate}
            currentDate={date}
            isToday={isToday}
          />
        </div>

        {data.total > 0 ? (
          <>
            {/* Stats row */}
            <div className="flex flex-wrap gap-4 mb-8">
              <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-lg">
                <Vote className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm font-medium">
                  {data.total} scrutin{data.total > 1 ? "s" : ""}
                </span>
              </div>
              {data.adopted > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 rounded-lg">
                  <CheckCircle className="h-4 w-4 text-green-600" aria-hidden="true" />
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">
                    {data.adopted} adopté{data.adopted > 1 ? "s" : ""}
                  </span>
                </div>
              )}
              {data.rejected > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 rounded-lg">
                  <XCircle className="h-4 w-4 text-red-600" aria-hidden="true" />
                  <span className="text-sm font-medium text-red-600 dark:text-red-400">
                    {data.rejected} rejeté{data.rejected > 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>

            {/* Chamber sections */}
            {(["AN", "SENAT"] as Chamber[]).map((chamber) => {
              const votes = data.grouped[chamber];
              if (votes.length === 0) return null;
              return <ChamberSection key={chamber} chamber={chamber} scrutins={votes} />;
            })}
          </>
        ) : (
          <EmptyState prevDate={adjacent.prevDate} />
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ChamberSection({ chamber, scrutins }: { chamber: Chamber; scrutins: DailyScrutin[] }) {
  return (
    <section className="mb-10">
      <div className="flex items-center gap-2.5 mb-4">
        <Building2
          className={`h-4 w-4 ${chamber === "AN" ? "text-blue-600" : "text-rose-600"}`}
          aria-hidden="true"
        />
        <h2 className="text-lg font-semibold">{CHAMBER_LABELS[chamber]}</h2>
        <span className="text-sm text-muted-foreground">
          {scrutins.length} scrutin{scrutins.length > 1 ? "s" : ""}
        </span>
      </div>
      <div className="grid gap-4">
        {scrutins.map((s) => (
          <div key={s.id}>
            <VoteCard
              id={s.id}
              externalId={s.externalId}
              slug={s.slug}
              title={s.title}
              votingDate={s.votingDate}
              legislature={s.legislature}
              chamber={s.chamber}
              votesFor={s.votesFor}
              votesAgainst={s.votesAgainst}
              votesAbstain={s.votesAbstain}
              result={s.result}
              sourceUrl={s.sourceUrl}
              theme={s.theme}
            />
            {s.summary && <SummaryExcerpt summary={s.summary} />}
          </div>
        ))}
      </div>
    </section>
  );
}

function SummaryExcerpt({ summary }: { summary: string }) {
  const firstParagraph = summary.split("\n\n")[0]?.trim();
  if (!firstParagraph) return null;

  return (
    <div className="mt-2 ml-4 pl-3 border-l-2 border-primary/20 text-sm text-muted-foreground">
      <div className="flex items-center gap-1.5 mb-1">
        <Sparkles className="h-3 w-3 text-primary/50" aria-hidden="true" />
        <span className="text-xs font-medium text-primary/50 uppercase tracking-wider">
          Résumé IA
        </span>
      </div>
      <p className="line-clamp-2">{firstParagraph}</p>
    </div>
  );
}

function EmptyState({ prevDate }: { prevDate: string | null }) {
  return (
    <div className="text-center py-20">
      <Vote className="h-10 w-10 mx-auto mb-4 text-muted-foreground/30" aria-hidden="true" />
      <p className="text-lg font-medium text-muted-foreground mb-2">Aucun scrutin ce jour</p>
      <p className="text-sm text-muted-foreground/60 mb-6">
        Le Parlement ne siège pas tous les jours (weekends, vacances, recesses).
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {prevDate && (
          <Link
            href={`/votes/${prevDate}`}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary hover:underline"
            prefetch={false}
          >
            Derniers votes ({formatDateFr(prevDate)})
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
        <Link
          href="/votes"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          prefetch={false}
        >
          Voir tous les votes
        </Link>
      </div>
    </div>
  );
}
