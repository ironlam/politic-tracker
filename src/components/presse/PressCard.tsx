import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

interface PressCardProps {
  id: string;
  title: string;
  description?: string | null;
  url: string;
  imageUrl?: string | null;
  feedSource: string;
  publishedAt: Date;
  mentions: Array<{
    politician: {
      slug: string;
      fullName: string;
    };
  }>;
  partyMentions: Array<{
    party: {
      slug: string | null;
      name: string;
      shortName: string;
      color: string | null;
    };
  }>;
}

const SOURCE_NAMES: Record<string, string> = {
  lemonde: "Le Monde",
  politico: "Politico",
  mediapart: "Mediapart",
};

const SOURCE_COLORS: Record<string, string> = {
  lemonde: "bg-yellow-100 text-yellow-800",
  politico: "bg-red-100 text-red-800",
  mediapart: "bg-orange-100 text-orange-800",
};

export function PressCard({
  title,
  description,
  url,
  imageUrl,
  feedSource,
  publishedAt,
  mentions,
  partyMentions,
}: PressCardProps) {
  const sourceName = SOURCE_NAMES[feedSource] || feedSource;
  const sourceColor = SOURCE_COLORS[feedSource] || "bg-gray-100 text-gray-800";

  const maxPoliticians = 3;
  const maxParties = 2;
  const visiblePoliticians = mentions.slice(0, maxPoliticians);
  const hiddenPoliticiansCount = mentions.length - maxPoliticians;
  const visibleParties = partyMentions.slice(0, maxParties);
  const hiddenPartiesCount = partyMentions.length - maxParties;

  return (
    <article className="group bg-card border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
      {/* Image */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block aspect-video bg-muted relative overflow-hidden"
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-muted-foreground/30">
            {sourceName.charAt(0)}
          </div>
        )}
        {/* Source badge overlay */}
        <Badge className={`absolute top-2 right-2 ${sourceColor}`}>{sourceName}</Badge>
      </a>

      {/* Content */}
      <div className="p-4">
        {/* Title */}
        <a href={url} target="_blank" rel="noopener noreferrer" className="block">
          <h3 className="font-semibold text-base line-clamp-2 group-hover:text-primary transition-colors">
            {title}
          </h3>
        </a>

        {/* Description */}
        {description && (
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{description}</p>
        )}

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
            {hiddenPoliticiansCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                +{hiddenPoliticiansCount}
              </Badge>
            )}
          </div>
        )}

        {/* Parties mentioned */}
        {partyMentions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {visibleParties.map((mention) => (
              <Link
                key={mention.party.shortName}
                href={mention.party.slug ? `/partis/${mention.party.slug}` : "/partis"}
                className="inline-block"
              >
                <Badge
                  variant="outline"
                  className="text-xs hover:bg-muted"
                  title={mention.party.name}
                  style={{
                    borderColor: mention.party.color || undefined,
                    color: mention.party.color || undefined,
                  }}
                >
                  {mention.party.shortName}
                </Badge>
              </Link>
            ))}
            {hiddenPartiesCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                +{hiddenPartiesCount}
              </Badge>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
