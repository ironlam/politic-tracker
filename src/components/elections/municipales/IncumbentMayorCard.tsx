import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface IncumbentMayorCardProps {
  mayor: {
    fullName: string;
    gender: string | null;
    mandateStart: Date | null;
    partyLabel: string | null;
    party: { shortName: string; color: string | null } | null;
    politician: {
      slug: string;
      fullName: string;
      photoUrl: string | null;
      blobPhotoUrl: string | null;
    } | null;
  };
  isRunningAgain: boolean;
}

export function IncumbentMayorCard({ mayor, isRunningAgain }: IncumbentMayorCardProps) {
  const startYear = mayor.mandateStart?.getFullYear();
  const partyName = mayor.party?.shortName ?? mayor.partyLabel;

  return (
    <div className="border rounded-xl p-4 bg-card">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
        Maire sortant{mayor.gender === "F" ? "e" : ""}
      </p>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-lg">
            {mayor.fullName}
            {partyName && <span className="text-muted-foreground font-normal"> ({partyName})</span>}
          </p>
          {startYear && (
            <p className="text-sm text-muted-foreground">En poste depuis {startYear}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isRunningAgain ? (
            <Badge variant="default" className="bg-emerald-600">
              Se représente
            </Badge>
          ) : (
            <Badge variant="secondary">Ne se représente pas</Badge>
          )}
          {mayor.politician && (
            <Link
              href={`/politiques/${mayor.politician.slug}`}
              className="text-sm text-primary hover:underline"
              prefetch={false}
            >
              Voir sa fiche
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
