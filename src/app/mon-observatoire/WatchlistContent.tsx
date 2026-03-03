"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Star, Vote, Newspaper, Scale, X, UserPlus, Loader2 } from "lucide-react";
import { useWatchlist } from "@/hooks/useWatchlist";
import { PoliticianAvatar } from "@/components/politicians/PoliticianAvatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  VOTE_POSITION_LABELS,
  VOTE_POSITION_COLORS,
  AFFAIR_CATEGORY_LABELS,
} from "@/config/labels";
import type { VotePosition, AffairCategory } from "@/generated/prisma";
import type { ActivityItem, ActivityResponse } from "@/types/activity";

export function WatchlistContent() {
  const { slugs, remove, count } = useWatchlist();
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slugsKey = slugs.join(",");

  useEffect(() => {
    if (slugs.length === 0) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch("/api/activity/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slugs }),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error("Erreur serveur");
        return res.json();
      })
      .then((json: ActivityResponse) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError("Impossible de charger l'activité");
        setLoading(false);
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugsKey]);

  // Empty state
  if (count === 0) {
    return <EmptyState />;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      {/* Sidebar — followed politicians */}
      <aside className="lg:col-span-1 order-2 lg:order-1">
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
          Mes représentants ({count})
        </h2>
        <div className="space-y-2">
          {data?.politicians.map((p) => (
            <div key={p.slug} className="flex items-center gap-2 group">
              <Link
                href={`/politiques/${p.slug}`}
                className="flex items-center gap-2 min-w-0 flex-1"
                prefetch={false}
              >
                <PoliticianAvatar photoUrl={p.photoUrl} fullName={p.fullName} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                    {p.fullName}
                  </p>
                  {p.party && <p className="text-xs text-muted-foreground">{p.party}</p>}
                </div>
              </Link>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => remove(p.slug)}
                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                aria-label={`Retirer ${p.fullName}`}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
          {/* Show slugs not yet resolved (loading state) */}
          {!data &&
            slugs.map((slug) => (
              <div key={slug} className="flex items-center gap-2">
                <div className="size-6 rounded-full bg-muted animate-pulse" />
                <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              </div>
            ))}
        </div>
      </aside>

      {/* Main — activity feed */}
      <main className="lg:col-span-3 order-1 lg:order-2">
        {loading && <LoadingSkeleton />}
        {error && (
          <div className="text-center py-12 text-muted-foreground">
            <p>{error}</p>
          </div>
        )}
        {data && !loading && data.activity.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              Pas d{"'"}activité récente pour vos représentants suivis.
            </p>
          </div>
        )}
        {data && !loading && data.activity.length > 0 && (
          <div className="space-y-3">
            {data.activity.map((item, i) => (
              <ActivityCard key={`${item.type}-${i}`} item={item} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ActivityCard({ item }: { item: ActivityItem }) {
  const date = new Date(item.date);
  const formattedDate = date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });

  return (
    <div className="flex gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <Link href={`/politiques/${item.politician.slug}`} prefetch={false} className="shrink-0">
        <PoliticianAvatar
          photoUrl={item.politician.photoUrl}
          fullName={item.politician.fullName}
          size="sm"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <Link
            href={`/politiques/${item.politician.slug}`}
            className="text-sm font-semibold hover:text-primary transition-colors truncate"
            prefetch={false}
          >
            {item.politician.fullName}
          </Link>
          <ActivityTypeBadge type={item.type} />
          <span className="text-xs text-muted-foreground ml-auto shrink-0">{formattedDate}</span>
        </div>
        <ActivityDetail item={item} />
      </div>
    </div>
  );
}

function ActivityTypeBadge({ type }: { type: ActivityItem["type"] }) {
  switch (type) {
    case "vote":
      return (
        <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0">
          <Vote className="size-3" />
          Vote
        </Badge>
      );
    case "press":
      return (
        <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0">
          <Newspaper className="size-3" />
          Presse
        </Badge>
      );
    case "affair":
      return (
        <Badge
          variant="outline"
          className="text-[10px] gap-1 px-1.5 py-0 border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400"
        >
          <Scale className="size-3" />
          Affaire
        </Badge>
      );
  }
}

function ActivityDetail({ item }: { item: ActivityItem }) {
  switch (item.type) {
    case "vote": {
      const position = item.data.position as VotePosition;
      const title = item.data.title as string;
      const slug = item.data.slug as string | null;
      const positionLabel = VOTE_POSITION_LABELS[position] ?? position;
      const positionColor = VOTE_POSITION_COLORS[position] ?? "#888";

      return (
        <p className="text-sm text-muted-foreground">
          A voté{" "}
          <span className="font-medium" style={{ color: positionColor }}>
            {positionLabel}
          </span>{" "}
          sur{" "}
          {slug ? (
            <Link href={`/votes/${slug}`} className="text-primary hover:underline" prefetch={false}>
              {title}
            </Link>
          ) : (
            <span>{title}</span>
          )}
        </p>
      );
    }
    case "press": {
      const title = item.data.title as string;
      const url = item.data.url as string;
      const source = item.data.source as string;

      return (
        <p className="text-sm text-muted-foreground">
          Mentionné dans{" "}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {title}
          </a>
          <span className="text-xs ml-1">({source})</span>
        </p>
      );
    }
    case "affair": {
      const title = item.data.title as string;
      const slug = item.data.slug as string;
      const category = item.data.category as AffairCategory;
      const categoryLabel = AFFAIR_CATEGORY_LABELS[category] ?? category;

      return (
        <p className="text-sm text-muted-foreground">
          <Link
            href={`/affaires/${slug}`}
            className="text-amber-700 dark:text-amber-400 hover:underline"
            prefetch={false}
          >
            {title}
          </Link>
          <span className="text-xs ml-1">({categoryLabel})</span>
        </p>
      );
    }
  }
}

function EmptyState() {
  return (
    <div className="text-center py-16 max-w-md mx-auto">
      <div className="mx-auto size-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Star className="size-8 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold mb-2">Aucun représentant suivi</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Ajoutez des représentants à votre observatoire pour suivre leurs votes, leurs mentions dans
        la presse et leurs affaires judiciaires.
      </p>
      <Button asChild>
        <Link href="/politiques">
          <UserPlus className="size-4 mr-2" />
          Parcourir les représentants
        </Link>
      </Button>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col items-center py-12 gap-3">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Chargement de l{"'"}activité...</p>
    </div>
  );
}
