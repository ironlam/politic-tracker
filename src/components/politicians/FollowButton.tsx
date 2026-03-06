"use client";

import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWatchlist } from "@/hooks/useWatchlist";
import { cn } from "@/lib/utils";
import type { WatchlistItemType } from "@/types/watchlist";

interface FollowButtonProps {
  slug: string;
  type?: WatchlistItemType;
  className?: string;
}

export function FollowButton({ slug, type = "politician", className }: FollowButtonProps) {
  const { toggle, isFollowing } = useWatchlist();
  const following = isFollowing(slug, type);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => toggle(slug, type)}
      className={cn(
        "gap-1.5 transition-colors",
        following &&
          "bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-400",
        className
      )}
      aria-label={following ? "Ne plus suivre" : "Suivre"}
      aria-pressed={following}
    >
      <Star className={cn("h-4 w-4", following && "fill-amber-500 text-amber-500")} />
      {following ? "Suivi" : "Suivre"}
    </Button>
  );
}
