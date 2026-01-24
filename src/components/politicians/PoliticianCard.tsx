import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PoliticianAvatar } from "./PoliticianAvatar";
import { MANDATE_TYPE_LABELS } from "@/config/labels";
import type { PoliticianWithParty, PoliticianWithPartyAndCounts } from "@/types";

interface PoliticianCardProps {
  politician: PoliticianWithParty | PoliticianWithPartyAndCounts;
  showConvictionBadge?: boolean;
}

// Format mandate for display (short version)
function formatMandateShort(mandate: { type: string; constituency: string | null } | null | undefined): string | null {
  if (!mandate) return null;

  const typeLabel = MANDATE_TYPE_LABELS[mandate.type as keyof typeof MANDATE_TYPE_LABELS] || mandate.type;

  if (mandate.constituency) {
    // Extract department name from "Département (numéro)"
    const match = mandate.constituency.match(/^([^(]+)/);
    const dept = match ? match[1].trim() : mandate.constituency;
    return `${typeLabel} · ${dept}`;
  }

  return typeLabel;
}

export function PoliticianCard({ politician, showConvictionBadge = false }: PoliticianCardProps) {
  const hasConviction = 'hasConviction' in politician && politician.hasConviction;
  const affairCount = '_count' in politician ? politician._count.affairs : 0;
  const isDeceased = politician.deathDate !== null;
  const currentMandate = 'currentMandate' in politician ? politician.currentMandate : null;
  const mandateDisplay = formatMandateShort(currentMandate);

  return (
    <Link href={`/politiques/${politician.slug}`} className="block group">
      <Card className={`h-full transition-all duration-200 hover:shadow-lg hover:border-primary/20 ${hasConviction ? 'ring-1 ring-red-200' : ''}`}>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="relative">
              <div className="transition-transform duration-200 group-hover:scale-105">
                <PoliticianAvatar
                  photoUrl={politician.photoUrl}
                  firstName={politician.firstName}
                  lastName={politician.lastName}
                  size="md"
                />
              </div>
              {showConvictionBadge && hasConviction && (
                <div
                  className="absolute -top-1 -right-1 w-5 h-5 bg-destructive rounded-full flex items-center justify-center shadow-sm"
                  title="Condamnation"
                >
                  <span className="text-white text-xs font-bold">!</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-lg truncate group-hover:text-primary transition-colors">
                {politician.fullName}
              </p>
              {mandateDisplay && (
                <p className="text-sm text-muted-foreground truncate mt-0.5">
                  {mandateDisplay}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {politician.currentParty && (
                  <Badge
                    variant="secondary"
                    className="font-medium"
                    style={{
                      backgroundColor: politician.currentParty.color
                        ? `${politician.currentParty.color}15`
                        : undefined,
                      color: politician.currentParty.color || undefined,
                      borderColor: politician.currentParty.color
                        ? `${politician.currentParty.color}30`
                        : undefined,
                    }}
                  >
                    {politician.currentParty.shortName}
                  </Badge>
                )}
                {isDeceased && (
                  <Badge variant="outline" className="text-xs text-muted-foreground bg-muted">
                    Décédé{politician.civility === 'Mme' ? 'e' : ''}
                  </Badge>
                )}
                {showConvictionBadge && affairCount > 0 && (
                  <Badge variant="outline" className="text-xs text-destructive/70 border-destructive/30">
                    {affairCount} affaire{affairCount > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
