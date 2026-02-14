import Link from "next/link";
import { formatDate } from "@/lib/utils";
import {
  MANDATE_TYPE_LABELS_PLURAL,
  AFFAIR_STATUS_LABELS,
  POLITICAL_POSITION_LABELS,
  VOTE_POSITION_LABELS,
  VOTE_POSITION_DOT_COLORS,
} from "@/config/labels";
import type {
  MandateType,
  AffairStatus,
  PoliticalPosition,
  FactCheckRating,
  VotePosition,
} from "@/types";

// ============================================
// Types
// ============================================

interface MandateCount {
  type: MandateType;
  count: number;
}

interface AffairData {
  id: string;
  status: AffairStatus;
}

interface FactCheckMentionData {
  factCheck: {
    verdictRating: FactCheckRating;
  };
}

interface ScrutinComparison {
  scrutinId: string;
  title: string;
  slug: string | null;
  votingDate: Date;
  leftPosition: string;
  rightPosition: string;
  leftPour: number;
  leftContre: number;
  leftAbstention: number;
  rightPour: number;
  rightContre: number;
  rightAbstention: number;
}

export interface PartyComparisonData {
  party: {
    id: string;
    slug: string | null;
    name: string;
    shortName: string;
    color: string | null;
    logoUrl: string | null;
    foundedDate: Date | null;
    politicalPosition: PoliticalPosition | null;
    ideology: string | null;
    memberCount: number;
  };
  mandateCounts: MandateCount[];
  affairs: AffairData[];
  factCheckMentions: FactCheckMentionData[];
}

interface PartyComparisonTableProps {
  left: PartyComparisonData;
  right: PartyComparisonData;
  voteComparison: ScrutinComparison[];
}

// ============================================
// Helpers
// ============================================

function formatFoundedDate(date: Date | null): string {
  if (!date) return "-";
  return new Date(date).getFullYear().toString();
}

// ============================================
// Row (duplicate from ComparisonTable — small component, no need to extract)
// ============================================

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
        className={`p-3 text-center w-1/3 ${leftHighlight ? "bg-red-500/10 text-red-700 dark:text-red-400 font-medium" : ""}`}
        style={leftColor ? { borderLeft: `4px solid ${leftColor}` } : undefined}
      >
        {left}
      </td>
      <td
        className={`p-3 text-center w-1/3 ${rightHighlight ? "bg-red-500/10 text-red-700 dark:text-red-400 font-medium" : ""}`}
        style={rightColor ? { borderLeft: `4px solid ${rightColor}` } : undefined}
      >
        {right}
      </td>
    </tr>
  );
}

// ============================================
// Vote concordance helpers
// ============================================

type AgreementType = "agree" | "disagree" | "partial";

function getMajorityAgreement(cv: ScrutinComparison): AgreementType {
  if (cv.leftPosition === cv.rightPosition) return "agree";
  // If one party didn't vote at all on a scrutin (all zeros), treat as partial
  const leftTotal = cv.leftPour + cv.leftContre + cv.leftAbstention;
  const rightTotal = cv.rightPour + cv.rightContre + cv.rightAbstention;
  if (leftTotal === 0 || rightTotal === 0) return "partial";
  // POUR vs CONTRE = disagree, everything else = partial
  if (
    (cv.leftPosition === "POUR" && cv.rightPosition === "CONTRE") ||
    (cv.leftPosition === "CONTRE" && cv.rightPosition === "POUR")
  ) {
    return "disagree";
  }
  return "partial";
}

// ============================================
// Sub-components
// ============================================

function MobileLabel({ name, color }: { name: string; color?: string | null }) {
  return (
    <p className="md:hidden text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: color || "#888" }}
      />
      {name}
    </p>
  );
}

function VerdictBar({ mentions }: { mentions: FactCheckMentionData[] }) {
  if (mentions.length === 0) {
    return (
      <div className="bg-muted rounded-lg p-4">
        <p className="text-muted-foreground text-center text-sm">Aucun fact-check</p>
      </div>
    );
  }

  const counts = mentions.reduce(
    (acc, m) => {
      const r = m.factCheck.verdictRating;
      if (r === "TRUE" || r === "MOSTLY_TRUE") acc.vrai++;
      else if (r === "HALF_TRUE" || r === "MISLEADING" || r === "OUT_OF_CONTEXT") acc.mitige++;
      else if (r === "FALSE" || r === "MOSTLY_FALSE") acc.faux++;
      else acc.autre++;
      return acc;
    },
    { vrai: 0, mitige: 0, faux: 0, autre: 0 }
  );
  const total = counts.vrai + counts.mitige + counts.faux + counts.autre;

  return (
    <div className="bg-muted rounded-lg p-4">
      <p className="text-xs font-medium mb-2">Verdicts des fact-checks</p>
      <div className="flex h-3 rounded-full overflow-hidden">
        {counts.faux > 0 && (
          <div
            className="bg-red-400"
            style={{ width: `${(counts.faux / total) * 100}%` }}
            title={`Faux : ${counts.faux}`}
          />
        )}
        {counts.mitige > 0 && (
          <div
            className="bg-yellow-400"
            style={{ width: `${(counts.mitige / total) * 100}%` }}
            title={`Mitigé : ${counts.mitige}`}
          />
        )}
        {counts.vrai > 0 && (
          <div
            className="bg-green-400"
            style={{ width: `${(counts.vrai / total) * 100}%` }}
            title={`Vrai : ${counts.vrai}`}
          />
        )}
        {counts.autre > 0 && (
          <div
            className="bg-gray-300"
            style={{ width: `${(counts.autre / total) * 100}%` }}
            title={`Autre : ${counts.autre}`}
          />
        )}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        {counts.faux > 0 && <span className="text-red-600">Faux : {counts.faux}</span>}
        {counts.mitige > 0 && <span className="text-yellow-600">Mitigé : {counts.mitige}</span>}
        {counts.vrai > 0 && <span className="text-green-600">Vrai : {counts.vrai}</span>}
        {counts.autre > 0 && <span className="text-gray-500">Autre : {counts.autre}</span>}
      </div>
    </div>
  );
}

// ============================================
// Main component
// ============================================

const MANDATE_DISPLAY_ORDER: MandateType[] = [
  "DEPUTE",
  "SENATEUR",
  "DEPUTE_EUROPEEN",
  "MINISTRE",
  "MINISTRE_DELEGUE",
  "SECRETAIRE_ETAT",
  "PREMIER_MINISTRE",
  "PRESIDENT_REPUBLIQUE",
  "PRESIDENT_PARTI",
];

export function PartyComparisonTable({ left, right, voteComparison }: PartyComparisonTableProps) {
  const lp = left.party;
  const rp = right.party;

  // Build mandate count maps
  const leftMandateMap = new Map(left.mandateCounts.map((m) => [m.type, m.count]));
  const rightMandateMap = new Map(right.mandateCounts.map((m) => [m.type, m.count]));

  // Only show mandate types that have at least one member in either party
  const mandateTypes = MANDATE_DISPLAY_ORDER.filter(
    (t) => (leftMandateMap.get(t) || 0) > 0 || (rightMandateMap.get(t) || 0) > 0
  );
  const leftTotalMandates = left.mandateCounts.reduce((sum, m) => sum + m.count, 0);
  const rightTotalMandates = right.mandateCounts.reduce((sum, m) => sum + m.count, 0);
  const hasMandates = leftTotalMandates > 0 || rightTotalMandates > 0;

  // Affairs by status
  const leftAffairsByStatus = left.affairs.reduce(
    (acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const rightAffairsByStatus = right.affairs.reduce(
    (acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const hasAffairs = left.affairs.length > 0 || right.affairs.length > 0;

  // Affair statuses to display
  const allStatuses = [
    ...new Set([...Object.keys(leftAffairsByStatus), ...Object.keys(rightAffairsByStatus)]),
  ] as AffairStatus[];

  // Fact-checks
  const hasFactChecks = left.factCheckMentions.length > 0 || right.factCheckMentions.length > 0;

  // Vote concordance
  const sortedVotes = [...voteComparison].sort(
    (a, b) => new Date(b.votingDate).getTime() - new Date(a.votingDate).getTime()
  );

  const voteStats = {
    total: sortedVotes.length,
    agree: sortedVotes.filter((v) => getMajorityAgreement(v) === "agree").length,
    disagree: sortedVotes.filter((v) => getMajorityAgreement(v) === "disagree").length,
    partial: sortedVotes.filter((v) => getMajorityAgreement(v) === "partial").length,
  };
  const hasVotes = voteStats.total > 0;
  const agreementRate = hasVotes ? Math.round((voteStats.agree / voteStats.total) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* 1. General Info */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Informations générales</h2>
        <div className="bg-muted rounded-lg overflow-hidden">
          <table className="w-full">
            <tbody>
              <Row
                label="Fondé en"
                left={formatFoundedDate(lp.foundedDate)}
                right={formatFoundedDate(rp.foundedDate)}
              />
              <Row
                label="Position politique"
                left={lp.politicalPosition ? POLITICAL_POSITION_LABELS[lp.politicalPosition] : "-"}
                right={rp.politicalPosition ? POLITICAL_POSITION_LABELS[rp.politicalPosition] : "-"}
                leftColor={lp.color}
                rightColor={rp.color}
              />
              {(lp.ideology || rp.ideology) && (
                <Row label="Idéologie" left={lp.ideology || "-"} right={rp.ideology || "-"} />
              )}
              <Row
                label="Membres en base"
                left={lp.memberCount.toString()}
                right={rp.memberCount.toString()}
              />
            </tbody>
          </table>
        </div>
      </section>

      {/* 2. Mandates by type */}
      {hasMandates && (
        <section>
          <h2 className="text-xl font-semibold mb-4">Représentants en exercice</h2>
          <div className="bg-muted rounded-lg overflow-hidden">
            <table className="w-full">
              <tbody>
                {mandateTypes.map((type) => (
                  <Row
                    key={type}
                    label={MANDATE_TYPE_LABELS_PLURAL[type]}
                    left={(leftMandateMap.get(type) || 0).toString()}
                    right={(rightMandateMap.get(type) || 0).toString()}
                  />
                ))}
                <Row
                  label="Total mandats actifs"
                  left={leftTotalMandates.toString()}
                  right={rightTotalMandates.toString()}
                />
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 3. Vote concordance */}
      {hasVotes && (
        <section>
          <h2 className="text-xl font-semibold mb-4">Concordance des votes</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Comparaison des positions majoritaires de chaque parti sur les scrutins communs.
          </p>

          {/* Stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted rounded-lg p-4 text-center">
              <p className="text-2xl font-bold">{voteStats.total}</p>
              <p className="text-sm text-muted-foreground">Scrutins comparés</p>
            </div>
            <div className="bg-green-500/10 dark:bg-green-500/20 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {voteStats.agree}
              </p>
              <p className="text-sm text-muted-foreground">D&apos;accord</p>
            </div>
            <div className="bg-red-500/10 dark:bg-red-500/20 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {voteStats.disagree}
              </p>
              <p className="text-sm text-muted-foreground">En désaccord</p>
            </div>
            <div className="bg-yellow-500/10 dark:bg-yellow-500/20 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {voteStats.partial}
              </p>
              <p className="text-sm text-muted-foreground">Partiellement</p>
            </div>
          </div>

          {/* Agreement bar */}
          <div className="bg-muted rounded-lg p-4 mt-4">
            <div className="flex justify-between mb-2 text-sm">
              <span>Taux de concordance</span>
              <span className="font-bold">{agreementRate}%</span>
            </div>
            <div className="h-4 rounded-full overflow-hidden bg-gray-200 flex">
              <div
                className="bg-green-500 transition-all"
                style={{ width: `${(voteStats.agree / voteStats.total) * 100}%` }}
                title={`D'accord: ${voteStats.agree}`}
              />
              <div
                className="bg-yellow-500 transition-all"
                style={{ width: `${(voteStats.partial / voteStats.total) * 100}%` }}
                title={`Partiellement: ${voteStats.partial}`}
              />
              <div
                className="bg-red-500 transition-all"
                style={{ width: `${(voteStats.disagree / voteStats.total) * 100}%` }}
                title={`En désaccord: ${voteStats.disagree}`}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-green-500" /> D&apos;accord
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-yellow-500" /> Partiellement
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-red-500" /> Désaccord
              </span>
            </div>
          </div>

          {/* Recent votes */}
          <div className="mt-4">
            <h3 className="font-semibold mb-4">Derniers scrutins comparés</h3>
            <div className="space-y-2">
              {sortedVotes.slice(0, 10).map((cv) => {
                const agreement = getMajorityAgreement(cv);
                return (
                  <div
                    key={cv.scrutinId}
                    className={`p-3 rounded-lg border ${
                      agreement === "agree"
                        ? "bg-green-500/10 border-green-500/30 dark:bg-green-500/10 dark:border-green-500/20"
                        : agreement === "disagree"
                          ? "bg-red-500/10 border-red-500/30 dark:bg-red-500/10 dark:border-red-500/20"
                          : "bg-yellow-500/10 border-yellow-500/30 dark:bg-yellow-500/10 dark:border-yellow-500/20"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/votes/${cv.slug || cv.scrutinId}`}
                          className="font-medium text-sm hover:underline line-clamp-1"
                        >
                          {cv.title}
                        </Link>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(new Date(cv.votingDate))}
                        </p>
                      </div>
                      <div className="flex gap-4 flex-shrink-0">
                        <div className="text-center">
                          <p className="text-xs font-medium text-muted-foreground mb-0.5 md:hidden">
                            {lp.shortName}
                          </p>
                          <span
                            className={`inline-block w-3 h-3 rounded-full ${VOTE_POSITION_DOT_COLORS[cv.leftPosition as VotePosition] || "bg-gray-400"}`}
                          />
                          <p className="text-xs mt-1">
                            {VOTE_POSITION_LABELS[cv.leftPosition as VotePosition] ||
                              cv.leftPosition}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-medium text-muted-foreground mb-0.5 md:hidden">
                            {rp.shortName}
                          </p>
                          <span
                            className={`inline-block w-3 h-3 rounded-full ${VOTE_POSITION_DOT_COLORS[cv.rightPosition as VotePosition] || "bg-gray-400"}`}
                          />
                          <p className="text-xs mt-1">
                            {VOTE_POSITION_LABELS[cv.rightPosition as VotePosition] ||
                              cv.rightPosition}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {sortedVotes.length > 10 && (
              <p className="text-center text-sm mt-4">
                <Link
                  href={`/comparer/votes?left=${encodeURIComponent(lp.slug || lp.id)}&right=${encodeURIComponent(rp.slug || rp.id)}&mode=partis`}
                  className="text-primary hover:underline"
                >
                  + {sortedVotes.length - 10} autres scrutins comparés
                </Link>
              </p>
            )}
          </div>
        </section>
      )}

      {/* 4. Affairs */}
      {hasAffairs && (
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
                {allStatuses.map((status) => (
                  <Row
                    key={status}
                    label={AFFAIR_STATUS_LABELS[status]}
                    left={(leftAffairsByStatus[status] || 0).toString()}
                    right={(rightAffairsByStatus[status] || 0).toString()}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 5. Fact-checks */}
      {hasFactChecks && (
        <section>
          <h2 className="text-xl font-semibold mb-4">Fact-checks</h2>
          <div className="bg-muted rounded-lg overflow-hidden">
            <table className="w-full">
              <tbody>
                <Row
                  label="Total fact-checks"
                  left={left.factCheckMentions.length.toString()}
                  right={right.factCheckMentions.length.toString()}
                />
              </tbody>
            </table>
          </div>
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div>
              <MobileLabel name={lp.shortName} color={lp.color} />
              <VerdictBar mentions={left.factCheckMentions} />
            </div>
            <div>
              <MobileLabel name={rp.shortName} color={rp.color} />
              <VerdictBar mentions={right.factCheckMentions} />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
