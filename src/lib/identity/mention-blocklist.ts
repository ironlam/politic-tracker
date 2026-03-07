/**
 * Mention blocklist for press and factcheck syncs.
 *
 * When an admin unlinks a false-positive mention, a NOT_SAME IdentityDecision
 * is recorded. Future syncs load these decisions and filter out blocked
 * (matchedName, politicianId) pairs.
 */

import { db } from "@/lib/db";
import { DataSource, Judgement, MatchMethod } from "@/generated/prisma";
import { normalizeText } from "@/lib/name-matching";

// ---------------------------------------------------------------------------
// Load blocklist (used by sync services)
// ---------------------------------------------------------------------------

export interface MentionBlocklist {
  isBlocked(matchedName: string, politicianId: string): boolean;
  size: number;
}

/**
 * Load all active NOT_SAME decisions for a source type into an in-memory Set.
 * Call once at sync start, then check O(1) per mention.
 *
 * Key: `normalizedName::politicianId` — blocking "arnault" for politician X
 * does not block "arnault" for a different politician Y.
 */
export async function loadMentionBlocklist(sourceType: DataSource): Promise<MentionBlocklist> {
  const decisions = await db.identityDecision.findMany({
    where: {
      sourceType,
      judgement: Judgement.NOT_SAME,
      supersededBy: null,
    },
    select: {
      sourceId: true,
      politicianId: true,
    },
  });

  const blocked = new Set<string>(decisions.map((d) => `${d.sourceId}::${d.politicianId}`));

  return {
    isBlocked(matchedName: string, politicianId: string): boolean {
      return blocked.has(`${normalizeText(matchedName)}::${politicianId}`);
    },
    get size() {
      return blocked.size;
    },
  };
}

// ---------------------------------------------------------------------------
// Record block (used by admin unlink routes)
// ---------------------------------------------------------------------------

/**
 * Record a NOT_SAME decision when an admin unlinks a mention.
 * Idempotent: skips if an identical active decision already exists.
 */
export async function recordMentionBlock(params: {
  sourceType: DataSource;
  matchedName: string;
  politicianId: string;
  politicianFullName: string;
  contextTitle: string;
  decidedBy: string;
}): Promise<void> {
  const normalizedName = normalizeText(params.matchedName);

  const existing = await db.identityDecision.findFirst({
    where: {
      sourceType: params.sourceType,
      sourceId: normalizedName,
      politicianId: params.politicianId,
      judgement: Judgement.NOT_SAME,
      supersededBy: null,
    },
  });

  if (existing) return;

  await db.identityDecision.create({
    data: {
      sourceType: params.sourceType,
      sourceId: normalizedName,
      politicianId: params.politicianId,
      judgement: Judgement.NOT_SAME,
      confidence: 1.0,
      method: MatchMethod.MANUAL,
      evidence: {
        matchedName: params.matchedName,
        normalizedName,
        politicianFullName: params.politicianFullName,
        context: params.contextTitle,
        action: "admin-unlink-mention",
      },
      decidedBy: params.decidedBy,
      decidedAt: new Date(),
    },
  });
}
