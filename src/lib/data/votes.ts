import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import type { Chamber, VotingResult, ThemeCategory } from "@/generated/prisma";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DailyScrutin {
  id: string;
  externalId: string;
  slug: string | null;
  title: string;
  votingDate: Date;
  legislature: number;
  chamber: Chamber;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  result: VotingResult;
  sourceUrl: string | null;
  theme: ThemeCategory | null;
  summary: string | null;
}

export interface DailyVotesData {
  scrutins: DailyScrutin[];
  grouped: Record<Chamber, DailyScrutin[]>;
  total: number;
  adopted: number;
  rejected: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get today's date string in Paris timezone (YYYY-MM-DD). */
export function getParisToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
}

/** Parse a YYYY-MM-DD string into a UTC start-of-day Date. */
function parseDateRange(dateStr: string): { start: Date; end: Date } {
  const start = new Date(dateStr + "T00:00:00Z");
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

const DAILY_SELECT = {
  id: true,
  externalId: true,
  slug: true,
  title: true,
  votingDate: true,
  legislature: true,
  chamber: true,
  votesFor: true,
  votesAgainst: true,
  votesAbstain: true,
  result: true,
  sourceUrl: true,
  theme: true,
  summary: true,
} as const;

// ---------------------------------------------------------------------------
// Data functions
// ---------------------------------------------------------------------------

/**
 * Get all scrutins for a given date, grouped by chamber.
 * Bounded key space (date string only) → safe for "use cache".
 */
export async function getScrutinsByDate(dateStr: string): Promise<DailyVotesData> {
  "use cache";
  cacheTag("votes", "votes-daily");
  cacheLife("minutes");

  const { start, end } = parseDateRange(dateStr);

  const scrutins = await db.scrutin.findMany({
    where: { votingDate: { gte: start, lt: end } },
    orderBy: { votingDate: "desc" },
    select: DAILY_SELECT,
  });

  const grouped: Record<Chamber, DailyScrutin[]> = { AN: [], SENAT: [] };
  let adopted = 0;
  let rejected = 0;

  for (const s of scrutins) {
    grouped[s.chamber].push(s);
    if (s.result === "ADOPTED") adopted++;
    else rejected++;
  }

  return { scrutins, grouped, total: scrutins.length, adopted, rejected };
}

/**
 * Find the nearest dates with votes before/after a given date.
 * Used for prev/next navigation.
 */
export async function getAdjacentVoteDates(
  dateStr: string
): Promise<{ prevDate: string | null; nextDate: string | null }> {
  "use cache";
  cacheTag("votes");
  cacheLife("minutes");

  const { start, end } = parseDateRange(dateStr);

  const [prev, next] = await Promise.all([
    db.scrutin.findFirst({
      where: { votingDate: { lt: start } },
      orderBy: { votingDate: "desc" },
      select: { votingDate: true },
    }),
    db.scrutin.findFirst({
      where: { votingDate: { gte: end } },
      orderBy: { votingDate: "asc" },
      select: { votingDate: true },
    }),
  ]);

  return {
    prevDate: prev ? prev.votingDate.toISOString().split("T")[0]! : null,
    nextDate: next ? next.votingDate.toISOString().split("T")[0]! : null,
  };
}

/**
 * Get today's vote summary for the homepage widget.
 */
export async function getTodayVotesSummary(): Promise<{
  total: number;
  adopted: number;
  rejected: number;
  date: string;
}> {
  "use cache";
  cacheTag("votes", "homepage");
  cacheLife("minutes");

  const dateStr = getParisToday();
  const { start, end } = parseDateRange(dateStr);

  const results = await db.scrutin.groupBy({
    by: ["result"],
    where: { votingDate: { gte: start, lt: end } },
    _count: true,
  });

  const adopted = results.find((r) => r.result === "ADOPTED")?._count ?? 0;
  const rejected = results.find((r) => r.result === "REJECTED")?._count ?? 0;

  return { total: adopted + rejected, adopted, rejected, date: dateStr };
}
