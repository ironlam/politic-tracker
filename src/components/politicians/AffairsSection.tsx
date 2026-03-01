import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AFFAIR_STATUS_LABELS,
  AFFAIR_STATUS_COLORS,
  INVOLVEMENT_LABELS,
  INVOLVEMENT_COLORS,
  AFFAIR_CATEGORY_LABELS,
  SEVERITY_SORT_ORDER,
} from "@/config/labels";
import { formatDate } from "@/lib/utils";
import type { AffairSeverity, AffairStatus, AffairCategory, Involvement } from "@/types";
import { AffairCard } from "./AffairCard";

const STATUS_SEVERITY: Record<string, number> = {
  CONDAMNATION_DEFINITIVE: 0,
  CONDAMNATION_PREMIERE_INSTANCE: 1,
  APPEL_EN_COURS: 2,
  PROCES_EN_COURS: 3,
  RENVOI_TRIBUNAL: 4,
  MISE_EN_EXAMEN: 5,
  INSTRUCTION: 6,
  ENQUETE_PRELIMINAIRE: 7,
  RELAXE: 8,
  ACQUITTEMENT: 9,
  NON_LIEU: 10,
  PRESCRIPTION: 11,
  CLASSEMENT_SANS_SUITE: 12,
};

interface AffairsSectionProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  affairs: any[];
  civility: string | null;
}

export function AffairsSection({ affairs, civility }: AffairsSectionProps) {
  // Split affairs by involvement: direct (mis en cause) vs mentions vs victim
  const directAffairs = affairs
    .filter((a) => a.involvement === "DIRECT")
    .sort((a, b) => {
      // Primary: severity (CRITIQUE first)
      const sevDiff =
        (SEVERITY_SORT_ORDER[a.severity as AffairSeverity] ?? 2) -
        (SEVERITY_SORT_ORDER[b.severity as AffairSeverity] ?? 2);
      if (sevDiff !== 0) return sevDiff;
      // Secondary: status severity
      return (STATUS_SEVERITY[a.status] ?? 99) - (STATUS_SEVERITY[b.status] ?? 99);
    });

  // Group direct affairs into editorial sections
  const critiqueAffairs = directAffairs.filter((a) => a.severity === "CRITIQUE");
  const otherDirectAffairs = directAffairs.filter((a) => a.severity !== "CRITIQUE");
  const mentionAffairs = affairs.filter(
    (a) =>
      a.involvement === "INDIRECT" ||
      a.involvement === "MENTIONED_ONLY" ||
      a.involvement === "PLAINTIFF"
  );
  const victimAffairs = affairs.filter((a) => a.involvement === "VICTIM");

  return (
    <div className="space-y-8">
      {/* Affairs -- Accused / Involved */}
      <Card id="affaires">
        <CardHeader>
          <h2 className="leading-none font-semibold">Affaires judiciaires</h2>
        </CardHeader>
        <CardContent>
          {directAffairs.length > 0 ? (
            <div className="space-y-8">
              {/* Atteintes a la probite (CRITIQUE) */}
              {critiqueAffairs.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-1">
                    Atteintes à la probité ({critiqueAffairs.length})
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Infractions liées à l&apos;exercice du mandat public
                  </p>
                  <div className="space-y-6">
                    {critiqueAffairs.map((affair) => (
                      <AffairCard key={affair.id} affair={affair} variant="critique" />
                    ))}
                  </div>
                </div>
              )}

              {/* Autres affaires judiciaires (GRAVE + SIGNIFICATIF) */}
              {otherDirectAffairs.length > 0 && (
                <div>
                  {critiqueAffairs.length > 0 && (
                    <h3 className="text-lg font-semibold text-muted-foreground mb-4">
                      Autres affaires judiciaires ({otherDirectAffairs.length})
                    </h3>
                  )}
                  <div className="space-y-6">
                    {otherDirectAffairs.map((affair) => (
                      <AffairCard key={affair.id} affair={affair} variant="other" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <p className="text-muted-foreground">
                Aucune affaire judiciaire documentée à ce jour.
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Cela ne signifie pas l&apos;absence d&apos;affaire — nos données sont enrichies
                progressivement.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Affairs -- Mentions (INDIRECT / MENTIONED_ONLY / PLAINTIFF) */}
      {mentionAffairs.length > 0 && (
        <Card className="border-dashed border-gray-300 dark:border-gray-700">
          <CardHeader>
            <details>
              <summary className="cursor-pointer list-none flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-4 h-4 text-muted-foreground transition-transform [[open]>&]:rotate-90"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                    clipRule="evenodd"
                  />
                </svg>
                <h2 className="leading-none font-semibold text-muted-foreground">
                  Mentions dans des affaires ({mentionAffairs.length})
                </h2>
              </summary>
              <p className="text-xs text-muted-foreground mt-2 sm:ml-6">
                Affaires où {civility === "MME" ? "elle" : "il"} est mentionné
                {civility === "MME" ? "e" : ""} sans être directement mis
                {civility === "MME" ? "e" : ""} en cause.
              </p>
              <div className="mt-4 space-y-4 sm:ml-6">
                {mentionAffairs.map((affair) => (
                  <div
                    key={affair.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50/50 dark:bg-gray-900/30"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge className={INVOLVEMENT_COLORS[affair.involvement as Involvement]}>
                            {INVOLVEMENT_LABELS[affair.involvement as Involvement]}
                          </Badge>
                          <Link
                            href={`/affaires/${affair.slug || affair.id}`}
                            className="font-medium hover:underline"
                          >
                            {affair.title}
                          </Link>
                        </div>
                        {affair.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {affair.description}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs self-start whitespace-nowrap">
                        {AFFAIR_STATUS_LABELS[affair.status as AffairStatus]}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </CardHeader>
        </Card>
      )}

      {/* Affairs -- Victim */}
      {victimAffairs.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="leading-none font-semibold">Victime d&apos;infractions</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {victimAffairs.map((affair) => (
                <div
                  key={affair.id}
                  id={`affair-${affair.id}`}
                  className="border rounded-lg p-4 border-blue-200 bg-blue-50/30"
                >
                  <div className="mb-3">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {(affair.verdictDate || affair.startDate || affair.factsDate) && (
                            <Badge variant="secondary" className="font-mono text-base font-bold">
                              {new Date(
                                affair.verdictDate || affair.startDate || affair.factsDate!
                              ).getFullYear()}
                            </Badge>
                          )}
                          <h3 className="font-semibold text-lg">{affair.title}</h3>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-start">
                        <Badge className="bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700 whitespace-nowrap">
                          {INVOLVEMENT_LABELS[affair.involvement as Involvement]}
                        </Badge>
                        <Badge
                          className={`whitespace-nowrap ${AFFAIR_STATUS_COLORS[affair.status as AffairStatus]}`}
                        >
                          {AFFAIR_STATUS_LABELS[affair.status as AffairStatus]}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {AFFAIR_CATEGORY_LABELS[affair.category as AffairCategory]}
                      </Badge>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground mb-3">{affair.description}</p>

                  {/* Dates */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-3">
                    {affair.factsDate && (
                      <div>
                        <span className="text-muted-foreground">Faits :</span>{" "}
                        <span className="font-medium">{formatDate(affair.factsDate)}</span>
                      </div>
                    )}
                    {affair.startDate && (
                      <div>
                        <span className="text-muted-foreground">Révélation :</span>{" "}
                        <span className="font-medium">{formatDate(affair.startDate)}</span>
                      </div>
                    )}
                  </div>

                  {/* Sources */}
                  {affair.sources.length > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Sources ({affair.sources.length})
                      </summary>
                      <ul className="mt-2 space-y-1 pl-4">
                        {affair.sources.map(
                          (source: {
                            id: string;
                            url: string;
                            title: string;
                            publisher: string;
                            publishedAt: Date;
                          }) => (
                            <li key={source.id}>
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                {source.title}
                              </a>
                              <span className="text-muted-foreground">
                                {" "}
                                — {source.publisher}, {formatDate(source.publishedAt)}
                              </span>
                            </li>
                          )
                        )}
                      </ul>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
