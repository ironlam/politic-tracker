import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CandidateRowProps {
  position: number | null;
  name: string;
  gender: string | null;
  politician: {
    slug: string;
    fullName: string;
    photoUrl: string | null;
    currentParty: { shortName: string; color: string | null } | null;
    mandates: Array<{ type: string }>;
  } | null;
}

function GenderDot({ gender }: { gender: string | null }) {
  return (
    <span
      className={cn(
        "w-2.5 h-2.5 rounded-full shrink-0",
        gender === "F" ? "bg-pink-400" : gender === "M" ? "bg-blue-400" : "bg-gray-300"
      )}
      aria-label={gender === "F" ? "Femme" : gender === "M" ? "Homme" : "Non renseigné"}
    />
  );
}

export function CandidateRow({ position, name, gender, politician }: CandidateRowProps) {
  return (
    <div className="flex items-center gap-3 py-1.5 px-2 text-sm">
      {/* Position */}
      <span className="text-muted-foreground tabular-nums w-6 text-right shrink-0">
        {position ?? "—"}
      </span>

      {/* Gender dot */}
      <GenderDot gender={gender} />

      {/* Name */}
      <span className="min-w-0 flex-1 truncate">
        {politician ? (
          <Link
            href={`/politiques/${politician.slug}`}
            className="hover:text-primary transition-colors font-medium"
            prefetch={false}
          >
            {name}
          </Link>
        ) : (
          name
        )}
      </span>

      {/* Fiche PoliGraph badge */}
      {politician && (
        <Badge variant="outline" className="shrink-0 text-xs">
          Fiche PoliGraph
        </Badge>
      )}
    </div>
  );
}
