import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PoliticianWithParty } from "@/types";

interface PoliticianCardProps {
  politician: PoliticianWithParty;
}

export function PoliticianCard({ politician }: PoliticianCardProps) {
  return (
    <Link href={`/politiques/${politician.slug}`} className="block">
      <Card className="hover:shadow-md transition-shadow h-full">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center text-xl font-semibold text-gray-600 flex-shrink-0">
              {politician.firstName[0]}
              {politician.lastName[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-lg truncate">
                {politician.fullName}
              </p>
              {politician.currentParty && (
                <Badge
                  variant="secondary"
                  className="mt-1"
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
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
