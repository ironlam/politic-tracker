import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { FACTCHECK_RATING_LABELS, FACTCHECK_RATING_COLORS } from "@/config/labels";
import type { FactCheckRating } from "@/types";

interface FactCheckCardProps {
  title: string;
  claimText: string;
  claimant?: string | null;
  verdict: string;
  verdictRating: FactCheckRating;
  source: string;
  sourceUrl: string;
  publishedAt: Date;
  mentions: Array<{
    politician: {
      slug: string;
      fullName: string;
    };
  }>;
}

export function FactCheckCard({
  title,
  claimText,
  claimant,
  verdictRating,
  source,
  sourceUrl,
  publishedAt,
  mentions,
}: FactCheckCardProps) {
  const ratingLabel = FACTCHECK_RATING_LABELS[verdictRating];
  const ratingColor = FACTCHECK_RATING_COLORS[verdictRating];

  const maxPoliticians = 3;
  const visiblePoliticians = mentions.slice(0, maxPoliticians);
  const hiddenCount = mentions.length - maxPoliticians;

  return (
    <article className="group bg-card border rounded-lg p-4 hover:shadow-md transition-shadow">
      {/* Header: verdict + source */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <Badge className={ratingColor}>{ratingLabel}</Badge>
        <span className="text-xs text-muted-foreground whitespace-nowrap">{source}</span>
      </div>

      {/* Title */}
      <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="block">
        <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">
          {title}
        </h3>
      </a>

      {/* Claim */}
      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
        {claimant && <span className="font-medium">{claimant} : </span>}
        &laquo;&nbsp;{claimText}&nbsp;&raquo;
      </p>

      {/* Date */}
      <p className="text-xs text-muted-foreground mt-2">{formatDate(publishedAt)}</p>

      {/* Politicians mentioned */}
      {mentions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {visiblePoliticians.map((mention) => (
            <Link
              key={mention.politician.slug}
              href={`/politiques/${mention.politician.slug}`}
              className="inline-block"
            >
              <Badge variant="outline" className="text-xs hover:bg-muted">
                {mention.politician.fullName}
              </Badge>
            </Link>
          ))}
          {hiddenCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              +{hiddenCount}
            </Badge>
          )}
        </div>
      )}

      {/* External link */}
      <a
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-primary hover:underline mt-2 inline-block"
      >
        Lire le fact-check →
      </a>
    </article>
  );
}
