/**
 * Recalculate prominence scores for all politicians.
 *
 * Score range: 0–1000
 * Components:
 *   mandateWeight  (0–400)  — highest mandate/party-role weight, current vs past
 *   activityScore  (0–200)  — votes, press mentions, fact-check mentions
 *   mediaScore     (0–150)  — recent press coverage (last 3 months)
 *   affairsScore   (0–100)  — judicial affairs count
 *   recencyBonus   (0–150)  — bonus for currently active politicians
 *
 * Usage:
 *   set -a && source .env && set +a && npx tsx scripts/recalculate-prominence.ts
 *   npx tsx scripts/recalculate-prominence.ts --dry-run --verbose
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

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
} from "../src/config/prominence";

// CLI flags
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const verbose = args.includes("--verbose");

// Initialize Prisma
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

// ── Helpers ──────────────────────────────────────────────────────────────────

function cap(value: number, max: number): number {
  return Math.min(Math.round(value), max);
}

function log(msg: string) {
  if (verbose) console.log(`  ${msg}`);
}

// ── Score calculation ────────────────────────────────────────────────────────

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

function calcMandateWeight(p: PoliticianData): number {
  // Best mandate weight (current or past)
  let bestMandateScore = 0;
  for (const m of p.mandates) {
    const baseWeight = MANDATE_WEIGHTS[m.type as keyof typeof MANDATE_WEIGHTS] ?? 0;
    const multiplier = m.isCurrent ? CURRENT_MANDATE_MULTIPLIER : PAST_MANDATE_MULTIPLIER;
    const score = baseWeight * multiplier;
    if (score > bestMandateScore) bestMandateScore = score;
  }

  // Best party role weight (for leaders without high mandates)
  let bestRoleScore = 0;
  for (const pm of p.partyHistory) {
    const roleWeight = PARTY_ROLE_WEIGHTS[pm.role as keyof typeof PARTY_ROLE_WEIGHTS] ?? 0;
    // Active role = endDate is null
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
  // 1) Has current mandate → 150
  const hasCurrentMandate = p.mandates.some((m) => m.isCurrent);
  if (hasCurrentMandate) return RECENCY_CONFIG.currentMandateBonus;

  // 2) Has active party role (non-MEMBER, endDate null) → 100
  const hasActiveRole = p.partyHistory.some((pm) => pm.role !== "MEMBER" && pm.endDate === null);
  if (hasActiveRole) return RECENCY_CONFIG.activePartyRoleBonus;

  // 3) Had mandate ending within last 5 years → 50
  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  const recentlyEnded = p.mandates.some(
    (m) => !m.isCurrent && m.endDate && m.endDate >= fiveYearsAgo
  );
  if (recentlyEnded) return RECENCY_CONFIG.recentlyActiveBonus;

  return 0;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Recalculate Prominence Scores ===");
  if (dryRun) console.log("[DRY RUN] No database changes will be made.\n");

  // 1. Fetch all politicians with relations and counts
  console.log("Fetching all politicians...");
  const politicians = await db.politician.findMany({
    select: {
      id: true,
      fullName: true,
      mandates: {
        select: {
          type: true,
          isCurrent: true,
          endDate: true,
        },
      },
      partyHistory: {
        select: {
          role: true,
          endDate: true,
        },
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
  console.log(`Found ${politicians.length} politicians.\n`);

  // 2. Fetch recent press mention counts (last N months) via groupBy
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - MEDIA_CONFIG.recentMonths);

  console.log(
    `Fetching recent press mentions (since ${threeMonthsAgo.toISOString().split("T")[0]})...`
  );
  const recentMentions = await db.pressArticleMention.groupBy({
    by: ["politicianId"],
    where: {
      article: {
        publishedAt: { gte: threeMonthsAgo },
      },
    },
    _count: {
      politicianId: true,
    },
  });

  const recentMentionMap = new Map<string, number>();
  for (const r of recentMentions) {
    recentMentionMap.set(r.politicianId, r._count.politicianId);
  }
  console.log(`Found recent mentions for ${recentMentionMap.size} politicians.\n`);

  // 3. Calculate scores
  console.log("Calculating scores...");
  const updates: { id: string; fullName: string; score: number }[] = [];

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

    updates.push({ id: p.id, fullName: p.fullName, score: total });

    log(
      `${p.fullName.padEnd(35)} mandate=${String(mandateWeight).padStart(3)} ` +
        `activity=${String(activityScore).padStart(3)} media=${String(mediaScore).padStart(3)} ` +
        `affairs=${String(affairsScore).padStart(3)} recency=${String(recencyBonus).padStart(3)} ` +
        `=> ${total}`
    );
  }

  // 4. Batch update in chunks of 500
  if (!dryRun) {
    const CHUNK_SIZE = 500;
    const totalChunks = Math.ceil(updates.length / CHUNK_SIZE);
    console.log(`\nUpdating ${updates.length} politicians in ${totalChunks} chunk(s)...`);

    for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
      const chunk = updates.slice(i, i + CHUNK_SIZE);
      const chunkNum = Math.floor(i / CHUNK_SIZE) + 1;

      await db.$transaction(
        chunk.map((u) =>
          db.politician.update({
            where: { id: u.id },
            data: { prominenceScore: u.score },
          })
        )
      );

      console.log(`  Chunk ${chunkNum}/${totalChunks} done (${chunk.length} updates).`);
    }

    console.log("All updates committed.");
  } else {
    console.log(`\n[DRY RUN] Would update ${updates.length} politicians.`);
  }

  // 5. Show top 20
  const sorted = [...updates].sort((a, b) => b.score - a.score);
  console.log("\n=== Top 20 Politicians by Prominence ===\n");
  console.log(`${"#".padStart(3)}  ${"Name".padEnd(35)} ${"Score".padStart(5)}`);
  console.log("-".repeat(48));

  for (let i = 0; i < Math.min(20, sorted.length); i++) {
    const p = sorted[i];
    console.log(
      `${String(i + 1).padStart(3)}. ${p.fullName.padEnd(35)} ${String(p.score).padStart(5)}`
    );
  }

  // 6. Summary statistics
  const scores = updates.map((u) => u.score);
  const nonZero = scores.filter((s) => s > 0);
  console.log("\n=== Summary ===");
  console.log(`Total politicians:    ${updates.length}`);
  console.log(`With score > 0:       ${nonZero.length}`);
  console.log(`Max score:            ${Math.max(...scores)}`);
  console.log(
    `Average score:        ${Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)}`
  );
  console.log(
    `Median score:         ${scores.sort((a, b) => a - b)[Math.floor(scores.length / 2)]}`
  );
}

main()
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
