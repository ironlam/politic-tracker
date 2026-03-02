import Image from "next/image";
import { formatDate } from "@/lib/utils";
import { MANDATE_TYPE_LABELS, POLITICAL_POSITION_LABELS } from "@/config/labels";
import { AffairsSection } from "../sections/AffairsSection";
import { FactchecksSection } from "../sections/FactchecksSection";
import { VoteConcordanceSection } from "../sections/VoteConcordanceSection";
import type { PartyComparisonData, PartyVoteComparisonRow } from "@/lib/data/compare";
import type { PoliticalPosition } from "@/types";

interface Props {
  left: PartyComparisonData;
  right: PartyComparisonData;
  voteComparison: PartyVoteComparisonRow[];
}

function countBy<T>(items: T[], key: keyof T): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const val = String(item[key]);
    counts[val] = (counts[val] || 0) + 1;
  }
  return counts;
}

export function PartisComparison({ left, right, voteComparison }: Props) {
  // Compute vote concordance from party majority positions
  const total = voteComparison.length;
  let agree = 0;
  let disagree = 0;
  let partial = 0;
  const divergent: Array<{
    scrutinId: string;
    title: string;
    slug: string | null;
    votingDate: Date;
    leftPosition: string;
    rightPosition: string;
  }> = [];

  for (const row of voteComparison) {
    if (row.leftPosition === row.rightPosition) {
      agree++;
    } else if (
      (row.leftPosition === "POUR" && row.rightPosition === "CONTRE") ||
      (row.leftPosition === "CONTRE" && row.rightPosition === "POUR")
    ) {
      disagree++;
      divergent.push({
        scrutinId: row.scrutinId,
        title: row.title,
        slug: row.slug,
        votingDate: row.votingDate,
        leftPosition: row.leftPosition,
        rightPosition: row.rightPosition,
      });
    } else {
      partial++;
    }
  }

  const concordanceStats = {
    total,
    agree,
    disagree,
    partial,
    agreementRate: total > 0 ? Math.round((agree / total) * 100) : 0,
  };

  return (
    <div className="space-y-8">
      {/* Info block */}
      <section>
        <h3 className="text-lg font-display font-semibold mb-4">Informations</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <PartyInfoCard data={left} />
          <PartyInfoCard data={right} />
        </div>
      </section>

      {/* Mandate counts */}
      <section>
        <h3 className="text-lg font-display font-semibold mb-4">Élus actuels</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <MandateCountsCard data={left} />
          <MandateCountsCard data={right} />
        </div>
      </section>

      {/* Vote concordance between parties */}
      {concordanceStats.total > 0 && (
        <VoteConcordanceSection
          stats={concordanceStats}
          recentDivergent={divergent.slice(0, 5)}
          compareVotesUrl={`/comparer/votes?cat=partis&a=${left.party.slug ?? left.party.id}&b=${right.party.slug ?? right.party.id}`}
          leftLabel={left.party.shortName}
          rightLabel={right.party.shortName}
        />
      )}

      <AffairsSection
        left={{
          count: left.affairs.length,
          byStatus: countBy(left.affairs, "status"),
          bySeverity: countBy(left.affairs, "severity"),
        }}
        right={{
          count: right.affairs.length,
          byStatus: countBy(right.affairs, "status"),
          bySeverity: countBy(right.affairs, "severity"),
        }}
        leftLabel={left.party.shortName}
        rightLabel={right.party.shortName}
      />

      <FactchecksSection
        left={{
          count: left.factCheckMentions.length,
          byVerdict: countBy(
            left.factCheckMentions.map((m) => m.factCheck),
            "verdictRating"
          ),
        }}
        right={{
          count: right.factCheckMentions.length,
          byVerdict: countBy(
            right.factCheckMentions.map((m) => m.factCheck),
            "verdictRating"
          ),
        }}
        leftLabel={left.party.shortName}
        rightLabel={right.party.shortName}
      />
    </div>
  );
}

function PartyInfoCard({ data }: { data: PartyComparisonData }) {
  const { party } = data;

  return (
    <div className="bg-muted rounded-lg p-4">
      <div className="flex items-center gap-3 mb-3">
        {party.logoUrl && (
          <Image
            src={party.logoUrl}
            alt={party.name}
            width={48}
            height={48}
            className="rounded object-contain"
          />
        )}
        <div className="min-w-0">
          <p className="font-semibold flex items-center gap-1.5">
            {party.color && (
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: party.color }}
              />
            )}
            <span className="truncate">{party.shortName}</span>
          </p>
          <p className="text-sm text-muted-foreground truncate">{party.name}</p>
        </div>
      </div>

      <ul className="space-y-1.5 text-sm">
        {party.politicalPosition && (
          <li className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Position</span>
            <span className="font-medium">
              {POLITICAL_POSITION_LABELS[party.politicalPosition as PoliticalPosition] ||
                party.politicalPosition}
            </span>
          </li>
        )}
        {party.ideology && (
          <li className="flex items-start justify-between gap-2">
            <span className="text-muted-foreground shrink-0">Idéologie</span>
            <span className="font-medium text-right">{party.ideology}</span>
          </li>
        )}
        {party.foundedDate && (
          <li className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Fondé le</span>
            <span className="font-medium">{formatDate(party.foundedDate)}</span>
          </li>
        )}
        <li className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Membres</span>
          <span className="font-medium">{party.memberCount}</span>
        </li>
      </ul>
    </div>
  );
}

function MandateCountsCard({ data }: { data: PartyComparisonData }) {
  const sorted = [...data.mandateCounts].sort((a, b) => b.count - a.count);
  const totalElus = sorted.reduce((s, m) => s + m.count, 0);

  if (totalElus === 0) {
    return (
      <div className="bg-muted rounded-lg p-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">{data.party.shortName}</p>
        <p className="text-muted-foreground text-sm text-center py-2">Aucun mandat en cours</p>
      </div>
    );
  }

  return (
    <div className="bg-muted rounded-lg p-4">
      <p className="text-xs font-medium text-muted-foreground mb-2">{data.party.shortName}</p>
      <p className="text-2xl font-bold mb-3">
        {totalElus} élu{totalElus > 1 ? "s" : ""}
      </p>
      <ul className="space-y-1">
        {sorted.map(({ type, count }) => (
          <li key={type} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{MANDATE_TYPE_LABELS[type] || type}</span>
            <span className="font-medium">{count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
