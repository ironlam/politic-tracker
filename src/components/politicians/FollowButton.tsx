"use client";

import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWatchlist } from "@/hooks/useWatchlist";
import { cn } from "@/lib/utils";

interface FollowButtonProps {
  slug: string;
  className?: string;
}

export function FollowButton({ slug, className }: FollowButtonProps) {
  const { isFollowing, toggle } = useWatchlist();
  const following = isFollowing(slug);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => toggle(slug)}
      className={cn(
        "gap-1.5",
        following &&
          "bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-400",
        className
      )}
      aria-label={following ? "Ne plus suivre" : "Suivre"}
      aria-pressed={following}
    >
      <Star
        className={cn(
          "size-4",
          following ? "fill-amber-500 text-amber-500" : "text-muted-foreground"
        )}
      />
      {following ? "Suivi" : "Suivre"}
    </Button>
  );
}
