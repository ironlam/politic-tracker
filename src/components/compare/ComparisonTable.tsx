import Link from "next/link";
import { MANDATE_TYPE_LABELS, AFFAIR_STATUS_LABELS } from "@/config/labels";
import type {
  Mandate,
  Affair,
  Declaration,
  Vote,
  Scrutin,
  MandateType,
  AffairStatus,
} from "@/types";

interface PoliticianData {
  id: string;
  slug: string;
  fullName: string;
  birthDate: Date | null;
  birthPlace: string | null;
  currentParty: { name: string; shortName: string; color: string | null } | null;
  mandates: Mandate[];
  affairs: Affair[];
  declarations: Declaration[];
  votes: (Vote & { scrutin: Scrutin })[];
  voteStats: {
    total: number;
    pour: number;
    contre: number;
    abstention: number;
    nonVotant?: number;
    absent: number;
  };
}

interface ComparisonTableProps {
  left: PoliticianData;
  right: PoliticianData;
}

function formatDate(date: Date | string | null): string {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function calculateAge(birthDate: Date | null): number | null {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function getCurrentMandate(mandates: Mandate[]): Mandate | null {
  return mandates.find((m) => m.isCurrent) || null;
}

function getTotalPatrimony(declarations: Declaration[]): number | null {
  const latest = declarations.filter((d) => d.totalNet !== null).sort((a, b) => b.year - a.year)[0];
  return latest?.totalNet ? Number(latest.totalNet) : null;
}

function formatMoney(amount: number | null): string {
  if (amount === null) return "-";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function ComparisonTable({ left, right }: ComparisonTableProps) {
  const leftAge = calculateAge(left.birthDate);
  const rightAge = calculateAge(right.birthDate);
  const leftMandate = getCurrentMandate(left.mandates);
  const rightMandate = getCurrentMandate(right.mandates);
  const leftPatrimony = getTotalPatrimony(left.declarations);
  const rightPatrimony = getTotalPatrimony(right.declarations);

  return (
    <div className="space-y-8">
      {/* General Info */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Informations générales</h2>
        <div className="bg-muted rounded-lg overflow-hidden">
          <table className="w-full">
            <tbody>
              <Row
                label="Date de naissance"
                left={left.birthDate ? `${formatDate(left.birthDate)} (${leftAge} ans)` : "-"}
                right={right.birthDate ? `${formatDate(right.birthDate)} (${rightAge} ans)` : "-"}
              />
              <Row
                label="Lieu de naissance"
                left={left.birthPlace || "-"}
                right={right.birthPlace || "-"}
              />
              <Row
                label="Parti actuel"
                left={left.currentParty?.name || "Sans étiquette"}
                right={right.currentParty?.name || "Sans étiquette"}
                leftColor={left.currentParty?.color}
                rightColor={right.currentParty?.color}
              />
              <Row
                label="Mandat actuel"
                left={leftMandate ? MANDATE_TYPE_LABELS[leftMandate.type as MandateType] : "Aucun"}
                right={
                  rightMandate ? MANDATE_TYPE_LABELS[rightMandate.type as MandateType] : "Aucun"
                }
              />
              <Row
                label="Circonscription"
                left={leftMandate?.constituency || "-"}
                right={rightMandate?.constituency || "-"}
              />
            </tbody>
          </table>
        </div>
      </section>

      {/* Mandates */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Mandats</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <MandateList mandates={left.mandates} />
          <MandateList mandates={right.mandates} />
        </div>
      </section>

      {/* Vote Statistics */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Statistiques de vote</h2>
        <div className="bg-muted rounded-lg overflow-hidden">
          <table className="w-full">
            <tbody>
              <Row
                label="Total des votes"
                left={left.voteStats.total.toString()}
                right={right.voteStats.total.toString()}
              />
              <Row
                label="Votes Pour"
                left={`${left.voteStats.pour} (${left.voteStats.total > 0 ? Math.round((left.voteStats.pour / left.voteStats.total) * 100) : 0}%)`}
                right={`${right.voteStats.pour} (${right.voteStats.total > 0 ? Math.round((right.voteStats.pour / right.voteStats.total) * 100) : 0}%)`}
              />
              <Row
                label="Votes Contre"
                left={`${left.voteStats.contre} (${left.voteStats.total > 0 ? Math.round((left.voteStats.contre / left.voteStats.total) * 100) : 0}%)`}
                right={`${right.voteStats.contre} (${right.voteStats.total > 0 ? Math.round((right.voteStats.contre / right.voteStats.total) * 100) : 0}%)`}
              />
              <Row
                label="Abstentions"
                left={`${left.voteStats.abstention} (${left.voteStats.total > 0 ? Math.round((left.voteStats.abstention / left.voteStats.total) * 100) : 0}%)`}
                right={`${right.voteStats.abstention} (${right.voteStats.total > 0 ? Math.round((right.voteStats.abstention / right.voteStats.total) * 100) : 0}%)`}
              />
              <Row
                label="Taux de participation"
                left={`${left.voteStats.total - (left.voteStats.nonVotant || 0) > 0 ? Math.round(((left.voteStats.total - left.voteStats.absent - (left.voteStats.nonVotant || 0)) / (left.voteStats.total - (left.voteStats.nonVotant || 0))) * 100) : 0}%`}
                right={`${right.voteStats.total - (right.voteStats.nonVotant || 0) > 0 ? Math.round(((right.voteStats.total - right.voteStats.absent - (right.voteStats.nonVotant || 0)) / (right.voteStats.total - (right.voteStats.nonVotant || 0))) * 100) : 0}%`}
              />
            </tbody>
          </table>
        </div>
      </section>

      {/* Patrimony */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Patrimoine déclaré (HATVP)</h2>
        <div className="bg-muted rounded-lg overflow-hidden">
          <table className="w-full">
            <tbody>
              <Row
                label="Patrimoine net"
                left={formatMoney(leftPatrimony)}
                right={formatMoney(rightPatrimony)}
              />
              <Row
                label="Déclarations"
                left={`${left.declarations.length} déclaration${left.declarations.length > 1 ? "s" : ""}`}
                right={`${right.declarations.length} déclaration${right.declarations.length > 1 ? "s" : ""}`}
              />
            </tbody>
          </table>
        </div>
      </section>

      {/* Affairs */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Affaires judiciaires</h2>
        <div className="bg-muted rounded-lg overflow-hidden">
          <table className="w-full">
            <tbody>
              <Row
                label="Nombre d'affaires"
                left={left.affairs.length.toString()}
                right={right.affairs.length.toString()}
                leftHighlight={left.affairs.length > 0}
                rightHighlight={right.affairs.length > 0}
              />
            </tbody>
          </table>
        </div>
        {(left.affairs.length > 0 || right.affairs.length > 0) && (
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <AffairList affairs={left.affairs} politicianSlug={left.slug} />
            <AffairList affairs={right.affairs} politicianSlug={right.slug} />
          </div>
        )}
      </section>
    </div>
  );
}

function Row({
  label,
  left,
  right,
  leftColor,
  rightColor,
  leftHighlight,
  rightHighlight,
}: {
  label: string;
  left: string;
  right: string;
  leftColor?: string | null;
  rightColor?: string | null;
  leftHighlight?: boolean;
  rightHighlight?: boolean;
}) {
  return (
    <tr className="border-b border-background last:border-0">
      <td className="p-3 text-center font-medium bg-background/50 w-1/3">{label}</td>
      <td
        className={`p-3 text-center w-1/3 ${leftHighlight ? "bg-red-50 text-red-700 font-medium" : ""}`}
        style={leftColor ? { borderLeft: `4px solid ${leftColor}` } : undefined}
      >
        {left}
      </td>
      <td
        className={`p-3 text-center w-1/3 ${rightHighlight ? "bg-red-50 text-red-700 font-medium" : ""}`}
        style={rightColor ? { borderLeft: `4px solid ${rightColor}` } : undefined}
      >
        {right}
      </td>
    </tr>
  );
}

function MandateList({ mandates }: { mandates: Mandate[] }) {
  const sorted = [...mandates].sort((a, b) => {
    if (a.isCurrent && !b.isCurrent) return -1;
    if (!a.isCurrent && b.isCurrent) return 1;
    return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
  });

  return (
    <div className="bg-muted rounded-lg p-4">
      {sorted.length === 0 ? (
        <p className="text-muted-foreground text-center">Aucun mandat</p>
      ) : (
        <ul className="space-y-2">
          {sorted.slice(0, 5).map((m) => (
            <li
              key={m.id}
              className={`text-sm ${m.isCurrent ? "font-medium" : "text-muted-foreground"}`}
            >
              {m.isCurrent && <span className="text-green-600 mr-1">●</span>}
              {MANDATE_TYPE_LABELS[m.type as MandateType]}
              {m.constituency && ` - ${m.constituency}`}
              <span className="text-xs text-muted-foreground ml-2">
                ({new Date(m.startDate).getFullYear()}
                {m.endDate ? ` - ${new Date(m.endDate).getFullYear()}` : ""})
              </span>
            </li>
          ))}
          {sorted.length > 5 && (
            <li className="text-xs text-muted-foreground">
              + {sorted.length - 5} autre{sorted.length - 5 > 1 ? "s" : ""} mandat
              {sorted.length - 5 > 1 ? "s" : ""}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function AffairList({ affairs, politicianSlug }: { affairs: Affair[]; politicianSlug: string }) {
  return (
    <div className="bg-muted rounded-lg p-4">
      {affairs.length === 0 ? (
        <p className="text-muted-foreground text-center">Aucune affaire</p>
      ) : (
        <ul className="space-y-2">
          {affairs.slice(0, 3).map((a) => (
            <li key={a.id} className="text-sm">
              <Link
                href={`/affaires/${a.slug}`}
                className="font-medium hover:underline text-primary"
              >
                {a.title}
              </Link>
              <span className="text-xs text-muted-foreground block">
                {AFFAIR_STATUS_LABELS[a.status as AffairStatus]}
              </span>
            </li>
          ))}
          {affairs.length > 3 && (
            <li>
              <Link
                href={`/politiques/${politicianSlug}#affaires`}
                className="text-xs text-primary hover:underline"
              >
                Voir les {affairs.length} affaires
              </Link>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
