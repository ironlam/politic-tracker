"use client";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface StatusTooltipProps {
  status: string;
  label: string;
  description: string;
  colorClass: string;
}

export function StatusTooltip({ label, description, colorClass }: StatusTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          <Badge className={`${colorClass} cursor-help`}>{label}</Badge>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[300px]">
        {description}
      </TooltipContent>
    </Tooltip>
  );
}
