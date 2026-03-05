import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { ElectionRoundData } from "@/lib/data/elections";

interface ElectionParticipationCardProps {
  round: ElectionRoundData;
}

export function ElectionParticipationCard({ round }: ElectionParticipationCardProps) {
  const label = round.round === 1 ? "1er tour" : "2nd tour";

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">{label}</h3>
          <span className="text-sm text-muted-foreground">{formatDate(round.date)}</span>
        </div>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          {round.participationRate != null && (
            <div>
              <dt className="text-muted-foreground">Participation</dt>
              <dd className="text-2xl font-bold tabular-nums">
                {round.participationRate.toFixed(1)} %
              </dd>
            </div>
          )}
          {round.registeredVoters != null && (
            <div>
              <dt className="text-muted-foreground">Inscrits</dt>
              <dd className="font-medium tabular-nums">
                {round.registeredVoters.toLocaleString("fr-FR")}
              </dd>
            </div>
          )}
          {round.actualVoters != null && (
            <div>
              <dt className="text-muted-foreground">Votants</dt>
              <dd className="font-medium tabular-nums">
                {round.actualVoters.toLocaleString("fr-FR")}
              </dd>
            </div>
          )}
          {round.blankVotes != null && (
            <div>
              <dt className="text-muted-foreground">Blancs</dt>
              <dd className="font-medium tabular-nums">
                {round.blankVotes.toLocaleString("fr-FR")}
              </dd>
            </div>
          )}
          {round.nullVotes != null && (
            <div>
              <dt className="text-muted-foreground">Nuls</dt>
              <dd className="font-medium tabular-nums">
                {round.nullVotes.toLocaleString("fr-FR")}
              </dd>
            </div>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}
