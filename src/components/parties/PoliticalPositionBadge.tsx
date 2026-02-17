"use client";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { POLITICAL_POSITION_LABELS, POLITICAL_POSITION_COLORS } from "@/config/labels";
import { PoliticalPosition } from "@/generated/prisma";

interface PoliticalPositionBadgeProps {
  position: PoliticalPosition;
  source?: string | null;
  sourceUrl?: string | null;
  className?: string;
}

export function PoliticalPositionBadge({
  position,
  source,
  sourceUrl,
  className,
}: PoliticalPositionBadgeProps) {
  const badge = (
    <Badge className={`${POLITICAL_POSITION_COLORS[position]} ${className || ""}`}>
      {POLITICAL_POSITION_LABELS[position]}
    </Badge>
  );

  if (!source) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Source : {source}</p>
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Voir la source
            </a>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
