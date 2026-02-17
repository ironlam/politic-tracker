"use client";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { POLITICAL_POSITION_LABELS, POLITICAL_POSITION_COLORS } from "@/config/labels";
import { PoliticalPosition } from "@/generated/prisma";
import { cn } from "@/lib/utils";

interface PoliticalPositionBadgeProps {
  position: PoliticalPosition;
  source?: string | null;
  className?: string;
}

export function PoliticalPositionBadge({
  position,
  source,
  className,
}: PoliticalPositionBadgeProps) {
  const badge = (
    <Badge className={cn(POLITICAL_POSITION_COLORS[position], className)}>
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
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
