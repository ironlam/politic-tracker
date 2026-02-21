/**
 * Prominence score recalculation service.
 *
 * Score range: 0–1000
 * Components:
 *   mandateWeight  (0–400) — highest mandate/party-role weight, current vs past
 *   activityScore  (0–200) — votes, press mentions, fact-check mentions
 *   mediaScore     (0–150) — recent press coverage (last 3 months)
 *   affairsScore   (0–100) — judicial affairs count
 *   recencyBonus   (0–150) — bonus for currently active politicians
 */

import { db } from "@/lib/db";
import {
  MANDATE_WEIGHTS,
  PARTY_ROLE_WEIGHTS,
  CURRENT_MANDATE_MULTIPLIER,
  PAST_MANDATE_MULTIPLIER,
  ACTIVITY_CONFIG,
  MEDIA_CONFIG,
  AFFAIRS_CONFIG,
  RECENCY_CONFIG,
  SCORE_CAPS,
} from "@/config/prominence";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProminenceOptions {
  dryRun?: boolean;
}

export interface ProminenceStats {
  totalPoliticians: number;
  updated: number;
  maxScore: number;
  averageScore: number;
}

interface PoliticianData {
  id: string;
  fullName: string;
  mandates: {
    type: string;
    isCurrent: boolean;
    endDate: Date | null;
  }[];
  partyHistory: {
    role: string;
    endDate: Date | null;
  }[];
  _count: {
    votes: number;
    pressMentions: number;
    factCheckMentions: number;
    affairs: number;
  };
}

// ---------------------------------------------------------------------------
// Score helpers
// ---------------------------------------------------------------------------

function cap(value: number, max: number): number {
  return Math.min(Math.round(value), max);
}

function calcMandateWeight(p: PoliticianData): number {
  let bestMandateScore = 0;
  for (const m of p.mandates) {
    const baseWeight = MANDATE_WEIGHTS[m.type as keyof typeof MANDATE_WEIGHTS] ?? 0;
    const multiplier = m.isCurrent ? CURRENT_MANDATE_MULTIPLIER : PAST_MANDATE_MULTIPLIER;
    const score = baseWeight * multiplier;
    if (score > bestMandateScore) bestMandateScore = score;
  }

  let bestRoleScore = 0;
  for (const pm of p.partyHistory) {
    const roleWeight = PARTY_ROLE_WEIGHTS[pm.role as keyof typeof PARTY_ROLE_WEIGHTS] ?? 0;
    const multiplier = pm.endDate === null ? CURRENT_MANDATE_MULTIPLIER : PAST_MANDATE_MULTIPLIER;
    const score = roleWeight * multiplier;
    if (score > bestRoleScore) bestRoleScore = score;
  }

  return cap(Math.max(bestMandateScore, bestRoleScore), SCORE_CAPS.mandate);
}

function calcActivityScore(p: PoliticianData): number {
  const votePoints = cap(
    p._count.votes * ACTIVITY_CONFIG.pointsPerVote,
    ACTIVITY_CONFIG.maxVotePoints
  );
  const pressPoints = cap(
    p._count.pressMentions * ACTIVITY_CONFIG.pointsPerPressMention,
    ACTIVITY_CONFIG.maxPressPoints
  );
  const factCheckPoints = cap(
    p._count.factCheckMentions * ACTIVITY_CONFIG.pointsPerFactCheck,
    ACTIVITY_CONFIG.maxFactCheckPoints
  );

  return cap(votePoints + pressPoints + factCheckPoints, SCORE_CAPS.activity);
}

function calcMediaScore(recentMentionCount: number): number {
  return cap(recentMentionCount * MEDIA_CONFIG.pointsPerRecentMention, SCORE_CAPS.media);
}

function calcAffairsScore(affairCount: number): number {
  return cap(affairCount * AFFAIRS_CONFIG.pointsPerAffair, SCORE_CAPS.affairs);
}

function calcRecencyBonus(p: PoliticianData): number {
  const hasCurrentMandate = p.mandates.some((m) => m.isCurrent);
  if (hasCurrentMandate) return RECENCY_CONFIG.currentMandateBonus;

  const hasActiveRole = p.partyHistory.some((pm) => pm.role !== "MEMBER" && pm.endDate === null);
  if (hasActiveRole) return RECENCY_CONFIG.activePartyRoleBonus;

  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  const recentlyEnded = p.mandates.some(
    (m) => !m.isCurrent && m.endDate && m.endDate >= fiveYearsAgo
  );
  if (recentlyEnded) return RECENCY_CONFIG.recentlyActiveBonus;

  return 0;
}

// ---------------------------------------------------------------------------
// Main service
// ---------------------------------------------------------------------------

export async function recalculateProminence(
  options: ProminenceOptions = {}
): Promise<ProminenceStats> {
  const { dryRun = false } = options;

  // 1. Fetch all politicians with relations and counts
  const politicians = await db.politician.findMany({
    select: {
      id: true,
      fullName: true,
      mandates: {
        select: { type: true, isCurrent: true, endDate: true },
      },
      partyHistory: {
        select: { role: true, endDate: true },
      },
      _count: {
        select: {
          votes: true,
          pressMentions: true,
          factCheckMentions: true,
          affairs: true,
        },
      },
    },
  });

  // 2. Fetch recent press mention counts
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - MEDIA_CONFIG.recentMonths);

  const recentMentions = await db.pressArticleMention.groupBy({
    by: ["politicianId"],
    where: {
      article: { publishedAt: { gte: threeMonthsAgo } },
    },
    _count: { politicianId: true },
  });

  const recentMentionMap = new Map<string, number>();
  for (const r of recentMentions) {
    recentMentionMap.set(r.politicianId, r._count.politicianId);
  }

  // 3. Calculate scores
  const updates: { id: string; score: number }[] = [];

  for (const p of politicians) {
    const mandateWeight = calcMandateWeight(p);
    const activityScore = calcActivityScore(p);
    const recentCount = recentMentionMap.get(p.id) ?? 0;
    const mediaScore = calcMediaScore(recentCount);
    const affairsScore = calcAffairsScore(p._count.affairs);
    const recencyBonus = calcRecencyBonus(p);

    const total = cap(
      mandateWeight + activityScore + mediaScore + affairsScore + recencyBonus,
      SCORE_CAPS.total
    );

    updates.push({ id: p.id, score: total });
  }

  // 4. Batch update in chunks of 100
  if (!dryRun) {
    const CHUNK_SIZE = 100;
    for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
      const chunk = updates.slice(i, i + CHUNK_SIZE);
      await db.$transaction(
        chunk.map((u) =>
          db.politician.update({
            where: { id: u.id },
            data: { prominenceScore: u.score },
          })
        )
      );
    }
  }

  const scores = updates.map((u) => u.score);

  return {
    totalPoliticians: updates.length,
    updated: dryRun ? 0 : updates.length,
    maxScore: scores.length > 0 ? Math.max(...scores) : 0,
    averageScore:
      scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
  };
}
