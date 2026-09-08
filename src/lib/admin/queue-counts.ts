/**
 * The predicates behind the admin workload counters, in one place.
 *
 * The dashboard and the sidebar badge endpoint each carried their own copy.
 * Correcting one and not the other showed the reduced workload on `/admin` and
 * the old historical totals in the navigation on the same screen, which is
 * worse than either number alone.
 *
 * A counter belongs here only if it needs a closure predicate: a queue counter
 * is a workload indicator only when every item costs something if it stays.
 */
import { db } from "@/lib/db";

/** Beyond this, a failure is history rather than a queue item. */
export const FAILURE_WINDOW_DAYS = 7;

function since(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * Analyzed articles that genuinely remain to be attached to an affair.
 *
 * Excludes those the attribution registry already resolved negatively: 443 of
 * 1761 on the live base. A resolved-negative article is an answer, not pending
 * work.
 *
 * Raw SQL because `AffairPoliticianDecision.sourceRef` is a free-form string
 * with no Prisma relation to `PressArticle.url`.
 */
export async function countArticlesToLink(): Promise<number> {
  const rows = await db.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) AS count
    FROM "PressArticle" a
    WHERE a."aiAnalyzedAt" IS NOT NULL
      AND a."isAffairRelated" = true
      AND NOT EXISTS (
        SELECT 1 FROM "PressArticleAffair" l WHERE l."articleId" = a.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM "AffairPoliticianDecision" d
        WHERE d."sourceRef" = a.url
          AND d.judgment IN ('NO_MATCH', 'NOT_SAME')
      )
  `;
  return Number(rows[0]?.count ?? 0);
}

/** Press-analysis rejections over the window. The model has no decision field,
 *  so this is a log: nothing in it can ever be marked handled. */
export function countRecentPressRejections(): Promise<number> {
  return db.pressAnalysisRejection.count({
    where: { rejectedAt: { gte: since(FAILURE_WINDOW_DAYS) } },
  });
}

/** Failed syncs over the window. Without it, a February failure still counted
 *  in September and the number never went down. */
export function countRecentFailedSyncs(): Promise<number> {
  return db.syncJob.count({
    where: { status: "FAILED", createdAt: { gte: since(FAILURE_WINDOW_DAYS) } },
  });
}
