import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MarkdownText } from "@/components/ui/markdown";
import { StatusBadge } from "./StatusBadge";
import { CategoryBadge } from "./CategoryBadge";
import type { DossierStatus } from "@/generated/prisma";
import { ExternalLink, FileText } from "lucide-react";

interface DossierCardProps {
  id: string;
  externalId: string;
  slug?: string | null;
  title: string;
  shortTitle?: string | null;
  number?: string | null;
  status: DossierStatus;
  category?: string | null;
  summary?: string | null;
  filingDate?: Date | null;
  adoptionDate?: Date | null;
  sourceUrl?: string | null;
  amendmentCount?: number;
  compact?: boolean;
}

export function DossierCard({
  id,
  slug,
  title,
  shortTitle,
  number,
  status,
  category,
  summary,
  filingDate,
  adoptionDate,
  sourceUrl,
  amendmentCount = 0,
  compact = false,
}: DossierCardProps) {
  // Use slug for URL if available, fallback to id
  const href = `/assemblee/${slug || id}`;
  const displayTitle = shortTitle || title;
  const displayDate = adoptionDate || filingDate;

  if (compact) {
    return (
      <div className="flex items-center justify-between py-2 border-b last:border-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {number && (
              <Badge variant="secondary" className="font-mono text-xs">
                {number}
              </Badge>
            )}
            <CategoryBadge category={category} showIcon={false} />
          </div>
          <Link href={href} className="text-sm font-medium hover:text-blue-600 line-clamp-1">
            {displayTitle}
          </Link>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <StatusBadge status={status} />
          {displayDate && (
            <span className="text-xs text-muted-foreground">
              {new Date(displayDate).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
              })}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-6">
        <div className="flex flex-col gap-4">
          {/* Header with badges */}
          <div className="flex flex-wrap items-center gap-2">
            {number && (
              <Badge variant="secondary" className="font-mono">
                {number}
              </Badge>
            )}
            <StatusBadge status={status} showIcon />
            <CategoryBadge category={category} />
          </div>

          {/* Title */}
          <div>
            <h3 className="text-lg font-semibold mb-1">
              <Link href={href} className="hover:text-blue-600">
                {displayTitle}
              </Link>
            </h3>
            {shortTitle && shortTitle !== title && (
              <p className="text-sm text-muted-foreground line-clamp-2">{title}</p>
            )}
          </div>

          {/* Summary */}
          {summary && (
            <div className="text-sm text-muted-foreground line-clamp-4">
              <MarkdownText>{summary}</MarkdownText>
            </div>
          )}

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {displayDate && (
                <span>
                  {status === "ADOPTE" ? "Adopté le" : "Déposé le"}{" "}
                  {new Date(displayDate).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              )}
              {amendmentCount > 0 && (
                <span className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  {amendmentCount} amendement{amendmentCount > 1 ? "s" : ""}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Link href={href} className="text-sm text-blue-600 hover:underline">
                Détails
              </Link>
              {sourceUrl && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-blue-600 flex items-center gap-1"
                >
                  Voir sur AN.fr
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
