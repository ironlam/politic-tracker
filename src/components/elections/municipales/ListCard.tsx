"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CandidateRow } from "@/components/elections/municipales/CandidateRow";
import { PoliticianBridge } from "@/components/elections/municipales/PoliticianBridge";

interface ListCardProps {
  name: string;
  partyLabel: string | null;
  candidateCount: number;
  femaleCount: number;
  teteDeListe: {
    candidateName: string;
    politician?: {
      slug: string;
      fullName: string;
    } | null;
  };
  members: Array<{
    id: string;
    candidateName: string;
    listPosition: number | null;
    candidate: { gender: string | null } | null;
    politician: {
      id: string;
      slug: string;
      fullName: string;
      photoUrl: string | null;
      currentParty: { shortName: string; color: string | null } | null;
      mandates: Array<{ type: string }>;
    } | null;
    participationRate?: number | null;
    affairsCount?: number;
  }>;
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("w-5 h-5 transition-transform duration-200", expanded && "rotate-180")}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ParityIndicator({ femaleCount, total }: { femaleCount: number; total: number }) {
  const rate = total > 0 ? femaleCount / total : 0;
  const isParityOk = rate >= 0.45;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        isParityOk ? "text-green-700" : "text-amber-600"
      )}
      title={`${Math.round(rate * 100)} % de femmes`}
    >
      {isParityOk ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-4 h-4"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-4 h-4"
          aria-hidden="true"
        >
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      )}
      <span className="sr-only">{isParityOk ? "Parite respectee" : "Parite insuffisante"}</span>
    </span>
  );
}

export function ListCard({
  name,
  partyLabel,
  candidateCount,
  femaleCount,
  teteDeListe,
  members,
}: ListCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardContent className="pt-6">
        {/* Header — always visible */}
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="w-full text-left flex items-center gap-3"
          aria-expanded={expanded}
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-bold truncate">{name}</span>
              {partyLabel && (
                <Badge variant="outline" className="shrink-0">
                  {partyLabel}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Tete de liste : {teteDeListe.candidateName}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-sm text-muted-foreground tabular-nums">
              {candidateCount} candidat{candidateCount > 1 ? "s" : ""}
            </span>
            <ParityIndicator femaleCount={femaleCount} total={candidateCount} />
            <ChevronIcon expanded={expanded} />
          </div>
        </button>

        {/* Expanded: full roster */}
        {expanded && (
          <div className="mt-4 border-t pt-3 space-y-0.5">
            {members.map((member) => (
              <div key={member.id}>
                <CandidateRow
                  position={member.listPosition}
                  name={member.candidateName}
                  gender={member.candidate?.gender ?? null}
                  politician={member.politician}
                />
                {member.politician && (
                  <PoliticianBridge
                    politician={member.politician}
                    participationRate={member.participationRate}
                    affairsCount={member.affairsCount}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
