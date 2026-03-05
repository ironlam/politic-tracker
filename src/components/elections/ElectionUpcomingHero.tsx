import { Card, CardContent } from "@/components/ui/card";
import { ElectionCountdown } from "@/components/elections/ElectionCountdown";
import { Info } from "lucide-react";

interface ElectionUpcomingHeroProps {
  targetDate: string;
  dateConfirmed: boolean;
  electionTitle: string;
  electionIcon: string;
}

export function ElectionUpcomingHero({
  targetDate,
  dateConfirmed,
  electionTitle,
  electionIcon,
}: ElectionUpcomingHeroProps) {
  return (
    <section className="space-y-6">
      {/* Full-width countdown */}
      <div className="bg-gradient-to-br from-primary/10 via-background to-accent/10 border rounded-2xl p-6 md:p-10">
        <ElectionCountdown
          targetDate={targetDate}
          electionTitle={electionTitle}
          electionIcon={electionIcon}
          dateConfirmed={dateConfirmed}
        />
      </div>

      {/* Info card */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="font-medium mb-1">Élection à venir</p>
              <p className="text-sm text-muted-foreground">
                Les candidatures et résultats seront ajoutés automatiquement au fur et à mesure de
                leur officialisation. Ajoutez cette élection à votre calendrier pour ne pas manquer
                les dates clés.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
