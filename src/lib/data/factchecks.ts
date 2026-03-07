import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import { FACTCHECK_ALLOWED_SOURCES } from "@/config/labels";
import { factcheckStatsService } from "@/services/factcheckStats";
import type { FactCheckRating } from "@/types";

/** Generic claimant patterns — must match GENERIC_CLAIMANT_PATTERNS in labels.ts */
const GENERIC_CLAIMANT_PATTERNS = [
  "réseaux sociaux",
  "sources multiples",
  "sites internet",
  "publications",
  "utilisateurs",
  "internautes",
  "viral",
  "facebook",
  "twitter",
  "tiktok",
  "whatsapp",
  "telegram",
  "youtube",
  "instagram",
  "chaîne de mails",
  "rumeur",
  "blog",
  "forum",
];

function buildDirectClaimFilter() {
  return {
    claimant: { not: null },
    NOT: GENERIC_CLAIMANT_PATTERNS.map((pattern) => ({
      claimant: { contains: pattern, mode: "insensitive" as const },
    })),
  };
}

/**
 * Fetch paginated fact-checks with filters.
 * Free-text search param — no cache (unbounded key space).
 */
export async function getFactchecks(params: {
  page: number;
  limit: number;
  source?: string;
  verdict?: string;
  politicianSlug?: string;
  search?: string;
  directOnly?: boolean;
}) {
  const { page, limit, source, verdict, politicianSlug, search, directOnly } = params;
  const skip = (page - 1) * limit;

  const where = {
    source: source || { in: FACTCHECK_ALLOWED_SOURCES },
    ...(verdict && { verdictRating: verdict as FactCheckRating }),
    ...(politicianSlug && {
      mentions: {
        some: {
          politician: { slug: politicianSlug },
        },
      },
    }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: "insensitive" as const } },
        { claimText: { contains: search, mode: "insensitive" as const } },
      ],
    }),
    ...(directOnly && buildDirectClaimFilter()),
  };

  const [factChecks, total] = await Promise.all([
    db.factCheck.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip,
      take: limit,
      include: {
        mentions: {
          select: {
            isClaimant: true,
            politician: {
              select: { slug: true, fullName: true },
            },
          },
        },
      },
    }),
    db.factCheck.count({ where }),
  ]);

  return {
    factChecks,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Aggregated page stats (total, by rating, top politicians) — cached.
 */
export async function getFactcheckStats() {
  "use cache";
  cacheTag("factchecks");
  cacheLife("minutes");

  return factcheckStatsService.getPageStats();
}

/**
 * Distinct sources with counts — cached.
 */
export async function getFactcheckSources() {
  "use cache";
  cacheTag("factchecks");
  cacheLife("minutes");

  const sources = await db.factCheck.groupBy({
    by: ["source"],
    where: { source: { in: FACTCHECK_ALLOWED_SOURCES } },
    _count: true,
    orderBy: { _count: { source: "desc" } },
  });
  return sources.map((s) => ({ name: s.source, count: s._count }));
}

/**
 * Resolve politician full name from slug (for filter badge display).
 */
export async function getPoliticianNameBySlug(slug: string): Promise<string | null> {
  const p = await db.politician.findUnique({
    where: { slug },
    select: { fullName: true },
  });
  return p?.fullName || null;
}
