import Image from "next/image";
import { formatDate } from "@/lib/utils";
import { MANDATE_TYPE_LABELS } from "@/config/labels";
import { AffairsSection } from "../sections/AffairsSection";
import { FactchecksSection } from "../sections/FactchecksSection";
import type { MinistreComparisonData } from "@/lib/data/compare";
import type { MandateType } from "@/types";

interface Props {
  left: MinistreComparisonData;
  right: MinistreComparisonData;
}

function countBy<T>(items: T[], key: keyof T): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const val = String(item[key]);
    counts[val] = (counts[val] || 0) + 1;
  }
  return counts;
}

export function MinistresComparison({ left, right }: Props) {
  return (
    <div className="space-y-8">
      {/* Info block */}
      <section>
        <h3 className="text-lg font-display font-semibold mb-4">Informations</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <MinistreInfoCard data={left} />
          <MinistreInfoCard data={right} />
        </div>
      </section>

      {/* Parcours */}
      <section>
        <h3 className="text-lg font-display font-semibold mb-4">Parcours</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <ParcoursTimeline data={left} />
          <ParcoursTimeline data={right} />
        </div>
      </section>

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
        leftLabel={left.fullName}
        rightLabel={right.fullName}
      />

      <FactchecksSection
        left={{
          count: left._count.factCheckMentions,
          byVerdict: countBy(
            left.factCheckMentions.map((m) => m.factCheck),
            "verdictRating"
          ),
        }}
        right={{
          count: right._count.factCheckMentions,
          byVerdict: countBy(
            right.factCheckMentions.map((m) => m.factCheck),
            "verdictRating"
          ),
        }}
        leftLabel={left.fullName}
        rightLabel={right.fullName}
      />
    </div>
  );
}

function MinistreInfoCard({ data }: { data: MinistreComparisonData }) {
  return (
    <div className="bg-muted rounded-lg p-4">
      <div className="flex items-center gap-3 mb-3">
        {data.photoUrl && (
          <Image
            src={data.photoUrl}
            alt={data.fullName}
            width={48}
            height={48}
            className="rounded-full object-cover"
          />
        )}
        <div className="min-w-0">
          <p className="font-semibold truncate">{data.fullName}</p>
          {data.currentParty && (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: data.currentParty.color || "#888" }}
              />
              {data.currentParty.shortName}
            </p>
          )}
        </div>
      </div>

      <ul className="space-y-1.5 text-sm">
        <li className="flex items-start justify-between gap-2">
          <span className="text-muted-foreground shrink-0">Fonction</span>
          <span className="font-medium text-right">{data.currentMandate.title}</span>
        </li>
        {data.currentMandate.governmentName && (
          <li className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Gouvernement</span>
            <span className="font-medium">{data.currentMandate.governmentName}</span>
          </li>
        )}
        <li className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Depuis le</span>
          <span className="font-medium">{formatDate(data.currentMandate.startDate)}</span>
        </li>
      </ul>
    </div>
  );
}

function ParcoursTimeline({ data }: { data: MinistreComparisonData }) {
  if (data.mandates.length === 0) {
    return (
      <div className="bg-muted rounded-lg p-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">{data.fullName}</p>
        <p className="text-muted-foreground text-sm text-center py-2">Aucun mandat enregistré</p>
      </div>
    );
  }

  return (
    <div className="bg-muted rounded-lg p-4">
      <p className="text-xs font-medium text-muted-foreground mb-3">{data.fullName}</p>
      <div className="relative pl-4 border-l-2 border-border space-y-3">
        {data.mandates.map((mandate, i) => (
          <div key={i} className="relative">
            <div
              className={`absolute -left-[calc(0.5rem+1px)] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-background ${mandate.isCurrent ? "bg-primary" : "bg-muted-foreground/40"}`}
            />
            <div className="pl-2">
              <p className="text-sm font-medium">{mandate.title}</p>
              <p className="text-xs text-muted-foreground">
                {MANDATE_TYPE_LABELS[mandate.type as MandateType]}
                {mandate.governmentName && ` — ${mandate.governmentName}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDate(mandate.startDate)}
                {mandate.endDate ? ` - ${formatDate(mandate.endDate)}` : " - en cours"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
