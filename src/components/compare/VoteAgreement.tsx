import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { VOTE_POSITION_LABELS, VOTE_POSITION_DOT_COLORS } from "@/config/labels";
import type { Vote, Scrutin, VotePosition } from "@/types";

interface VoteWithScrutin extends Vote {
  scrutin: Scrutin;
}

interface VoteAgreementProps {
  leftVotes: VoteWithScrutin[];
  rightVotes: VoteWithScrutin[];
  leftName: string;
  rightName: string;
}

type AgreementType = "agree" | "disagree" | "partial";

interface ComparedVote {
  scrutin: Scrutin;
  leftPosition: VotePosition;
  rightPosition: VotePosition;
  agreement: AgreementType;
}

function getAgreement(left: VotePosition, right: VotePosition): AgreementType {
  if (left === right) return "agree";
  if (left === "ABSENT" || right === "ABSENT") return "partial";
  if (left === "ABSTENTION" || right === "ABSTENTION") return "partial";
  return "disagree";
}

export function VoteAgreement({ leftVotes, rightVotes, leftName, rightName }: VoteAgreementProps) {
  // Create a map of scrutin ID to votes
  const leftVoteMap = new Map(leftVotes.map((v) => [v.scrutinId, v]));
  const rightVoteMap = new Map(rightVotes.map((v) => [v.scrutinId, v]));

  // Find common scrutins
  const commonScrutinIds = [...leftVoteMap.keys()].filter((id) => rightVoteMap.has(id));

  if (commonScrutinIds.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Aucun vote en commun trouvé.</p>
        <p className="text-sm mt-2">
          Ces deux politiques n&apos;ont pas participé aux mêmes scrutins.
        </p>
      </div>
    );
  }

  // Compare votes
  const comparedVotes: ComparedVote[] = commonScrutinIds.map((scrutinId) => {
    const leftVote = leftVoteMap.get(scrutinId)!;
    const rightVote = rightVoteMap.get(scrutinId)!;
    return {
      scrutin: leftVote.scrutin,
      leftPosition: leftVote.position,
      rightPosition: rightVote.position,
      agreement: getAgreement(leftVote.position, rightVote.position),
    };
  });

  // Sort by date (most recent first)
  comparedVotes.sort(
    (a, b) => new Date(b.scrutin.votingDate).getTime() - new Date(a.scrutin.votingDate).getTime()
  );

  // Calculate stats
  const stats = {
    total: comparedVotes.length,
    agree: comparedVotes.filter((v) => v.agreement === "agree").length,
    disagree: comparedVotes.filter((v) => v.agreement === "disagree").length,
    partial: comparedVotes.filter((v) => v.agreement === "partial").length,
  };

  const agreementRate = Math.round((stats.agree / stats.total) * 100);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-muted rounded-lg p-4 text-center">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-sm text-muted-foreground">Votes en commun</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.agree}</p>
          <p className="text-sm text-muted-foreground">D&apos;accord</p>
        </div>
        <div className="bg-red-50 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{stats.disagree}</p>
          <p className="text-sm text-muted-foreground">En désaccord</p>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-yellow-600">{stats.partial}</p>
          <p className="text-sm text-muted-foreground">Partiellement</p>
        </div>
      </div>

      {/* Agreement bar */}
      <div className="bg-muted rounded-lg p-4">
        <div className="flex justify-between mb-2 text-sm">
          <span>Taux de concordance</span>
          <span className="font-bold">{agreementRate}%</span>
        </div>
        <div className="h-4 rounded-full overflow-hidden bg-gray-200 flex">
          <div
            className="bg-green-500 transition-all"
            style={{ width: `${(stats.agree / stats.total) * 100}%` }}
            title={`D'accord: ${stats.agree}`}
          />
          <div
            className="bg-yellow-500 transition-all"
            style={{ width: `${(stats.partial / stats.total) * 100}%` }}
            title={`Partiellement: ${stats.partial}`}
          />
          <div
            className="bg-red-500 transition-all"
            style={{ width: `${(stats.disagree / stats.total) * 100}%` }}
            title={`En désaccord: ${stats.disagree}`}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
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

      {/* Recent votes comparison */}
      <div>
        <h3 className="font-semibold mb-4">Derniers votes comparés</h3>
        <div className="space-y-2">
          {comparedVotes.slice(0, 10).map((cv) => (
            <div
              key={cv.scrutin.id}
              className={`p-3 rounded-lg border ${
                cv.agreement === "agree"
                  ? "bg-green-50 border-green-200"
                  : cv.agreement === "disagree"
                    ? "bg-red-50 border-red-200"
                    : "bg-yellow-50 border-yellow-200"
              }`}
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/votes/${cv.scrutin.slug || cv.scrutin.id}`}
                    className="font-medium text-sm hover:underline line-clamp-1"
                  >
                    {cv.scrutin.title}
                  </Link>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDate(new Date(cv.scrutin.votingDate))}
                  </p>
                </div>
                <div className="flex gap-4 flex-shrink-0">
                  <div className="text-center">
                    <span
                      className={`inline-block w-3 h-3 rounded-full ${VOTE_POSITION_DOT_COLORS[cv.leftPosition]}`}
                    />
                    <p className="text-xs mt-1">{VOTE_POSITION_LABELS[cv.leftPosition]}</p>
                  </div>
                  <div className="text-center">
                    <span
                      className={`inline-block w-3 h-3 rounded-full ${VOTE_POSITION_DOT_COLORS[cv.rightPosition]}`}
                    />
                    <p className="text-xs mt-1">{VOTE_POSITION_LABELS[cv.rightPosition]}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        {comparedVotes.length > 10 && (
          <p className="text-center text-sm text-muted-foreground mt-4">
            + {comparedVotes.length - 10} autres votes en commun
          </p>
        )}
      </div>
    </div>
  );
}
