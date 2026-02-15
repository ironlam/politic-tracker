import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AFFAIR_STATUS_LABELS,
  AFFAIR_STATUS_COLORS,
  AFFAIR_CATEGORY_LABELS,
  SOURCE_TYPE_LABELS,
} from "@/config/labels";
import { formatDate } from "@/lib/utils";
import type { SourceType } from "@/generated/prisma";
import { findPotentialDuplicates } from "@/services/affairs/reconciliation";
import { VerifyActions } from "./VerifyActions";
import { DuplicateActions } from "./DuplicateActions";
import Link from "next/link";

async function getUnverifiedAffairs() {
  return db.affair.findMany({
    where: { verifiedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      politician: { select: { id: true, fullName: true, slug: true } },
      sources: { select: { id: true, sourceType: true } },
    },
  });
}

async function getRecentEvents() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return db.affairEvent.findMany({
    where: { date: { gte: thirtyDaysAgo } },
    orderBy: { date: "desc" },
    take: 50,
    include: {
      affair: {
        select: {
          id: true,
          title: true,
          politician: { select: { fullName: true, slug: true } },
        },
      },
    },
  });
}

function getSourceBadgeColor(sourceType: SourceType): string {
  const colors: Record<SourceType, string> = {
    WIKIDATA: "bg-blue-100 text-blue-800",
    JUDILIBRE: "bg-purple-100 text-purple-800",
    LEGIFRANCE: "bg-indigo-100 text-indigo-800",
    PRESSE: "bg-amber-100 text-amber-800",
    MANUAL: "bg-gray-100 text-gray-800",
  };
  return colors[sourceType] ?? "bg-gray-100 text-gray-800";
}

export default async function VerificationPage() {
  const [unverified, duplicates, recentEvents] = await Promise.all([
    getUnverifiedAffairs(),
    findPotentialDuplicates(),
    getRecentEvents(),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">File de vérification</h1>

      {/* Section 1: À vérifier */}
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-lg">À vérifier ({unverified.length})</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {unverified.length > 0 ? (
            <div className="space-y-3">
              {unverified.map((affair) => {
                const sourceTypes = [...new Set(affair.sources.map((s) => s.sourceType))];
                return (
                  <div
                    key={affair.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/admin/affaires/${affair.id}`}
                          className="font-medium hover:underline truncate"
                        >
                          {affair.title}
                        </Link>
                        {sourceTypes.map((st) => (
                          <Badge key={st} className={getSourceBadgeColor(st)}>
                            {SOURCE_TYPE_LABELS[st]}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <Link
                          href={`/politiques/${affair.politician.slug}`}
                          className="hover:underline"
                        >
                          {affair.politician.fullName}
                        </Link>
                        <span>{AFFAIR_CATEGORY_LABELS[affair.category]}</span>
                        <Badge className={AFFAIR_STATUS_COLORS[affair.status]}>
                          {AFFAIR_STATUS_LABELS[affair.status]}
                        </Badge>
                        <span>{formatDate(affair.createdAt)}</span>
                      </div>
                    </div>
                    <VerifyActions affairId={affair.id} />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center py-6 text-muted-foreground">
              Aucune affaire en attente de vérification.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Doublons potentiels */}
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-lg">Doublons potentiels ({duplicates.length})</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {duplicates.length > 0 ? (
            <div className="space-y-4">
              {duplicates.map((dup, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge
                      className={
                        dup.confidence === "CERTAIN"
                          ? "bg-red-100 text-red-800"
                          : dup.confidence === "HIGH"
                            ? "bg-orange-100 text-orange-800"
                            : "bg-yellow-100 text-yellow-800"
                      }
                    >
                      {dup.confidence}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Score : {(dup.score * 100).toFixed(0)}% — Match par : {dup.matchedBy}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 rounded">
                      <div className="font-medium text-sm mb-1">Affaire A</div>
                      <Link
                        href={`/admin/affaires/${dup.affairA.id}`}
                        className="hover:underline text-sm"
                      >
                        {dup.affairA.title}
                      </Link>
                      <div className="flex gap-1 mt-1">
                        {dup.affairA.sources.map((st) => (
                          <Badge key={st} className={`text-xs ${getSourceBadgeColor(st)}`}>
                            {SOURCE_TYPE_LABELS[st]}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded">
                      <div className="font-medium text-sm mb-1">Affaire B</div>
                      <Link
                        href={`/admin/affaires/${dup.affairB.id}`}
                        className="hover:underline text-sm"
                      >
                        {dup.affairB.title}
                      </Link>
                      <div className="flex gap-1 mt-1">
                        {dup.affairB.sources.map((st) => (
                          <Badge key={st} className={`text-xs ${getSourceBadgeColor(st)}`}>
                            {SOURCE_TYPE_LABELS[st]}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <DuplicateActions affairIdA={dup.affairA.id} affairIdB={dup.affairB.id} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-6 text-muted-foreground">Aucun doublon détecté.</p>
          )}
        </CardContent>
      </Card>

      {/* Section 3: Changements récents */}
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-lg">Changements récents ({recentEvents.length})</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentEvents.length > 0 ? (
            <div className="space-y-2">
              {recentEvents.map((event) => (
                <div key={event.id} className="flex items-start gap-3 p-2 border-b last:border-0">
                  <div className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatDate(event.date)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">{event.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      <Link href={`/admin/affaires/${event.affair.id}`} className="hover:underline">
                        {event.affair.title}
                      </Link>
                      {event.affair.politician && (
                        <>
                          {" — "}
                          <Link
                            href={`/politiques/${event.affair.politician.slug}`}
                            className="hover:underline"
                          >
                            {event.affair.politician.fullName}
                          </Link>
                        </>
                      )}
                    </div>
                    {event.sourceUrl && (
                      <a
                        href={event.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {event.sourceTitle || "Source"}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-6 text-muted-foreground">
              Aucun changement de statut ces 30 derniers jours.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
