import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { VotingResultBadge } from "./VoteBadge";
import { formatDate } from "@/lib/utils";
import type { VotingResult, Chamber } from "@/types";
import { CHAMBER_SHORT_LABELS } from "@/config/labels";
import { Calendar, Users, ExternalLink, Building2 } from "lucide-react";

interface VoteCardProps {
  id: string;
  externalId: string;
  slug?: string | null;
  title: string;
  votingDate: Date | string;
  legislature: number;
  chamber?: Chamber;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  result: VotingResult;
  sourceUrl?: string | null;
  totalVotes?: number;
}

export function VoteCard({
  id,
  externalId,
  slug,
  title,
  votingDate,
  legislature,
  chamber,
  votesFor,
  votesAgainst,
  votesAbstain,
  result,
  sourceUrl,
  totalVotes,
}: VoteCardProps) {
  // Use slug for URL if available, fallback to id
  const href = `/votes/${slug || id}`;
  const total = votesFor + votesAgainst + votesAbstain;
  const forPercent = total > 0 ? (votesFor / total) * 100 : 0;
  const againstPercent = total > 0 ? (votesAgainst / total) * 100 : 0;
  const abstainPercent = total > 0 ? (votesAbstain / total) * 100 : 0;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <Link href={href} className="hover:underline">
              <h3 className="font-medium text-sm line-clamp-2">{title}</h3>
            </Link>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              {chamber && (
                <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${
                  chamber === "AN"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-rose-100 text-rose-700"
                }`}>
                  <Building2 className="h-3 w-3" />
                  {CHAMBER_SHORT_LABELS[chamber]}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(new Date(votingDate))}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {total} votants
              </span>
              <span className="text-muted-foreground/60">
                {legislature}e législature
              </span>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <VotingResultBadge result={result} />
            {sourceUrl && (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
                title="Voir sur NosDéputés.fr"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>

        {/* Vote bar */}
        <div className="space-y-1">
          <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
            <div
              className="bg-green-500 transition-all"
              style={{ width: `${forPercent}%` }}
              title={`Pour: ${votesFor}`}
            />
            <div
              className="bg-red-500 transition-all"
              style={{ width: `${againstPercent}%` }}
              title={`Contre: ${votesAgainst}`}
            />
            <div
              className="bg-yellow-500 transition-all"
              style={{ width: `${abstainPercent}%` }}
              title={`Abstention: ${votesAbstain}`}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="text-green-600">Pour: {votesFor}</span>
            <span className="text-red-600">Contre: {votesAgainst}</span>
            <span className="text-yellow-600">Abstention: {votesAbstain}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
