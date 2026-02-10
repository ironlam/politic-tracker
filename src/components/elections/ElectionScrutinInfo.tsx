import { Card, CardContent } from "@/components/ui/card";
import { ELECTION_TYPE_LABELS, ELECTION_SCOPE_LABELS, SUFFRAGE_TYPE_LABELS } from "@/config/labels";
import type { ElectionType, ElectionScope, SuffrageType } from "@/types";

interface ElectionScrutinInfoProps {
  type: ElectionType;
  scope: ElectionScope;
  suffrage: SuffrageType;
  totalSeats: number | null;
}

const SCRUTIN_DESCRIPTIONS: Record<ElectionType, string> = {
  PRESIDENTIELLE:
    "Scrutin uninominal majoritaire à deux tours. Pour être élu au premier tour, un candidat doit obtenir la majorité absolue des suffrages exprimés. À défaut, un second tour oppose les deux candidats arrivés en tête.",
  LEGISLATIVES:
    "Scrutin uninominal majoritaire à deux tours par circonscription. Un candidat est élu au premier tour s'il obtient la majorité absolue et au moins 25 % des inscrits. Sinon, les candidats ayant obtenu au moins 12,5 % des inscrits peuvent se maintenir au second tour.",
  SENATORIALES:
    "Mode de scrutin mixte selon les départements. Dans les départements élisant 1 ou 2 sénateurs : scrutin majoritaire à deux tours. Dans les départements élisant 3 sénateurs ou plus : scrutin proportionnel de liste.",
  MUNICIPALES:
    "Dans les communes de 1 000 habitants et plus : scrutin proportionnel de liste à deux tours avec prime majoritaire. Dans les communes de moins de 1 000 habitants : scrutin majoritaire plurinominal à deux tours.",
  DEPARTEMENTALES:
    "Scrutin binominal majoritaire à deux tours. Chaque canton élit un binôme (un homme et une femme). Le binôme est élu au premier tour s'il obtient la majorité absolue et au moins 25 % des inscrits.",
  REGIONALES:
    "Scrutin proportionnel de liste à deux tours avec prime majoritaire. La liste arrivée en tête obtient 25 % des sièges, les sièges restants étant répartis à la proportionnelle entre les listes ayant obtenu au moins 5 %.",
  EUROPEENNES:
    "Scrutin proportionnel de liste à un seul tour dans une circonscription nationale unique. Les sièges sont répartis entre les listes ayant obtenu au moins 5 % des suffrages exprimés.",
  REFERENDUM:
    "Vote direct des citoyens par oui ou non sur une question posée par le Président de la République. Le résultat s'impose si la majorité des suffrages exprimés l'approuve.",
};

export function ElectionScrutinInfo({
  type,
  scope,
  suffrage,
  totalSeats,
}: ElectionScrutinInfoProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="text-lg font-semibold mb-4">Mode de scrutin</h2>

        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Type</dt>
            <dd className="font-medium">{ELECTION_TYPE_LABELS[type]}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Échelon</dt>
            <dd className="font-medium">{ELECTION_SCOPE_LABELS[scope]}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Suffrage</dt>
            <dd className="font-medium">{SUFFRAGE_TYPE_LABELS[suffrage]}</dd>
          </div>
          {totalSeats && (
            <div>
              <dt className="text-muted-foreground">Sièges à pourvoir</dt>
              <dd className="font-medium">{totalSeats.toLocaleString("fr-FR")}</dd>
            </div>
          )}
        </dl>

        <div className="mt-4 pt-4 border-t">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {SCRUTIN_DESCRIPTIONS[type]}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
