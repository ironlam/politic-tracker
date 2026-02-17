"use client";

import { Info } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { GLOSSARY, type GlossaryKey } from "@/config/glossary";
import { cn } from "@/lib/utils";

interface InfoTooltipProps {
  /** Use a glossary key for centralized definitions */
  term?: GlossaryKey;
  /** Or provide custom text directly */
  text?: string;
  /** Visual size — "sm" for inline, "md" for standalone */
  size?: "sm" | "md";
  /** Additional CSS classes on the trigger button */
  className?: string;
  /** Side of the tooltip */
  side?: "top" | "bottom" | "left" | "right";
}

/**
 * Small info icon (?) that shows an explanatory tooltip on hover/focus.
 * Accessible: focusable, announces content to screen readers.
 *
 * Usage:
 *   <InfoTooltip term="sursis" />           // from glossary
 *   <InfoTooltip text="Custom explanation" /> // inline text
 */
export function InfoTooltip({
  term,
  text,
  size = "sm",
  className,
  side = "top",
}: InfoTooltipProps) {
  const content = term ? GLOSSARY[term] : text;
  if (!content) return null;

  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center justify-center rounded-full text-muted-foreground/60 hover:text-muted-foreground transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            size === "sm" ? "p-0.5" : "p-1",
            className
          )}
          aria-label={`Aide : ${term || "information"}`}
        >
          <Info className={iconSize} aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-[280px] text-[13px] leading-relaxed">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
