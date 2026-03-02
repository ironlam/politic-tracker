import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { VOTE_POSITION_LABELS, VOTE_POSITION_DOT_COLORS } from "@/config/labels";
import type { VotePosition } from "@/types";

interface ConcordanceStats {
  total: number;
  agree: number;
  disagree: number;
  partial: number;
  agreementRate: number; // 0-100
}

interface DivergentVote {
  scrutinId: string;
  title: string;
  slug: string | null;
  votingDate: Date;
  leftPosition: string;
  rightPosition: string;
}

interface VoteConcordanceSectionProps {
  stats: ConcordanceStats;
  recentDivergent: DivergentVote[];
  compareVotesUrl: string;
  leftLabel: string;
  rightLabel: string;
}

export function VoteConcordanceSection({
  stats,
  recentDivergent,
  compareVotesUrl,
  leftLabel,
  rightLabel,
}: VoteConcordanceSectionProps) {
  if (stats.total === 0) {
    return (
      <section>
        <h3 className="text-lg font-display font-semibold mb-4">Concordance de vote</h3>
        <div className="text-center py-8 text-muted-foreground">
          <p>Aucun vote en commun</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h3 className="text-lg font-display font-semibold mb-4">Concordance de vote</h3>
      <div className="space-y-5">
        {/* Agreement rate headline */}
        <div className="bg-muted rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Taux de concordance</span>
            <span className="text-3xl font-bold">{stats.agreementRate}%</span>
          </div>
          {/* Stacked progress bar */}
          <div className="h-4 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex">
            {stats.agree > 0 && (
              <div
                className="bg-green-500 transition-all"
                style={{ width: `${(stats.agree / stats.total) * 100}%` }}
                title={`D'accord : ${stats.agree}`}
              />
            )}
            {stats.partial > 0 && (
              <div
                className="bg-yellow-500 transition-all"
                style={{ width: `${(stats.partial / stats.total) * 100}%` }}
                title={`Partiellement : ${stats.partial}`}
              />
            )}
            {stats.disagree > 0 && (
              <div
                className="bg-red-500 transition-all"
                style={{ width: `${(stats.disagree / stats.total) * 100}%` }}
                title={`En désaccord : ${stats.disagree}`}
              />
            )}
          </div>
          <div className="flex flex-wrap justify-between gap-1 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-green-500" /> D&apos;accord
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-yellow-500" /> Partiellement
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-red-500" /> Désaccord
            </span>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard value={stats.total} label="Votes communs" />
          <StatCard
            value={stats.agree}
            label="D'accord"
            className="bg-green-500/10 dark:bg-green-500/20"
            valueClassName="text-green-600 dark:text-green-400"
          />
          <StatCard
            value={stats.disagree}
            label="En désaccord"
            className="bg-red-500/10 dark:bg-red-500/20"
            valueClassName="text-red-600 dark:text-red-400"
          />
          <StatCard
            value={stats.partial}
            label="Partiels"
            className="bg-yellow-500/10 dark:bg-yellow-500/20"
            valueClassName="text-yellow-600 dark:text-yellow-400"
          />
        </div>

        {/* Divergent votes list */}
        {recentDivergent.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-3">Principaux désaccords</p>
            <div className="space-y-2">
              {recentDivergent.slice(0, 5).map((vote) => (
                <div
                  key={vote.scrutinId}
                  className="p-3 rounded-lg border bg-red-500/5 border-red-500/20 dark:bg-red-500/10 dark:border-red-500/15"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/votes/${vote.slug || vote.scrutinId}`}
                        className="font-medium text-sm hover:underline text-primary line-clamp-1"
                        prefetch={false}
                      >
                        {vote.title}
                      </Link>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(new Date(vote.votingDate))}
                      </p>
                    </div>
                    <div className="flex gap-4 flex-shrink-0">
                      <PositionDot position={vote.leftPosition as VotePosition} name={leftLabel} />
                      <PositionDot
                        position={vote.rightPosition as VotePosition}
                        name={rightLabel}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Link to full comparison */}
        <div className="text-center">
          <Link
            href={compareVotesUrl}
            className="text-sm text-primary hover:underline"
            prefetch={false}
          >
            Voir tous les votes &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}

function StatCard({
  value,
  label,
  className = "bg-muted",
  valueClassName = "",
}: {
  value: number;
  label: string;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={`rounded-lg p-3 text-center ${className}`}>
      <p className={`text-xl font-bold ${valueClassName}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function PositionDot({ position, name }: { position: VotePosition; name: string }) {
  const dotColor = VOTE_POSITION_DOT_COLORS[position] || "bg-gray-400";
  const posLabel = VOTE_POSITION_LABELS[position] || position;

  return (
    <div className="text-center">
      <p className="text-xs font-medium text-muted-foreground mb-0.5 line-clamp-1 max-w-[60px]">
        {name.split(" ").pop()}
      </p>
      <span className={`inline-block w-3 h-3 rounded-full ${dotColor}`} />
      <p className="text-xs mt-0.5">{posLabel}</p>
    </div>
  );
}
