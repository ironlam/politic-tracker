import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PoliticianAvatar } from "./PoliticianAvatar";
import type { PoliticianWithParty, PoliticianWithPartyAndCounts } from "@/types";

interface PoliticianCardProps {
  politician: PoliticianWithParty | PoliticianWithPartyAndCounts;
  showConvictionBadge?: boolean;
}

export function PoliticianCard({ politician, showConvictionBadge = false }: PoliticianCardProps) {
  const hasConviction = 'hasConviction' in politician && politician.hasConviction;
  const affairCount = '_count' in politician ? politician._count.affairs : 0;

  return (
    <Link href={`/politiques/${politician.slug}`} className="block">
      <Card className={`hover:shadow-md transition-shadow h-full ${hasConviction ? 'ring-1 ring-red-200' : ''}`}>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="relative">
              <PoliticianAvatar
                photoUrl={politician.photoUrl}
                firstName={politician.firstName}
                lastName={politician.lastName}
                size="md"
              />
              {showConvictionBadge && hasConviction && (
                <div
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                  title="Condamnation"
                >
                  <span className="text-white text-xs font-bold">!</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-lg truncate">
                {politician.fullName}
              </p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {politician.currentParty && (
                  <Badge
                    variant="secondary"
                    style={{
                      backgroundColor: politician.currentParty.color
                        ? `${politician.currentParty.color}20`
                        : undefined,
                      color: politician.currentParty.color || undefined,
                      borderColor: politician.currentParty.color || undefined,
                    }}
                  >
                    {politician.currentParty.shortName}
                  </Badge>
                )}
                {showConvictionBadge && affairCount > 0 && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
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
