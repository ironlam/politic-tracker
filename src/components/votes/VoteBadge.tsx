import { Badge } from "@/components/ui/badge";
import type { VotePosition, VotingResult } from "@/types";
import {
  VOTE_POSITION_LABELS,
  VOTE_POSITION_COLORS,
  VOTING_RESULT_LABELS,
  VOTING_RESULT_COLORS,
} from "@/config/labels";

interface VotePositionBadgeProps {
  position: VotePosition;
  size?: "sm" | "md";
}

export function VotePositionBadge({ position, size = "md" }: VotePositionBadgeProps) {
  const sizeClasses = size === "sm" ? "text-xs px-1.5 py-0.5" : "";

  return (
    <Badge variant="outline" className={`${VOTE_POSITION_COLORS[position]} ${sizeClasses}`}>
      {VOTE_POSITION_LABELS[position]}
    </Badge>
  );
}

interface VotingResultBadgeProps {
  result: VotingResult;
}

export function VotingResultBadge({ result }: VotingResultBadgeProps) {
  return <Badge className={VOTING_RESULT_COLORS[result]}>{VOTING_RESULT_LABELS[result]}</Badge>;
}
