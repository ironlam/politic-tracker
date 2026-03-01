/**
 * Orchestration service for generating AI biographies.
 * Queries DB → loops → calls generateBiography → updates DB.
 * Extracted from scripts/generate-biographies.ts for Inngest compatibility.
 */

import { db } from "@/lib/db";
import { generateBiography, type BiographyRequest } from "@/services/summarize";
import { MANDATE_TYPE_LABELS } from "@/config/labels";
import { MandateType } from "@/generated/prisma";
import { AI_RATE_LIMIT_MS, AI_429_BACKOFF_MS } from "@/config/rate-limits";

export interface BiographiesResult {
  processed: number;
  generated: number;
  skipped: number;
  errors: string[];
}

function mandateTitle(mandate: {
  type: string;
  title: string | null;
  institution: string | null;
}): string {
  const label = MANDATE_TYPE_LABELS[mandate.type as MandateType] || mandate.type;
  if (mandate.title) return mandate.title;
  if (mandate.institution) return `${label} — ${mandate.institution}`;
  return label;
}

export async function generateBiographies(options?: {
  limit?: number;
  force?: boolean;
}): Promise<BiographiesResult> {
  const { limit, force = false } = options ?? {};

  const stats: BiographiesResult = {
    processed: 0,
    generated: 0,
    skipped: 0,
    errors: [],
  };

  const whereClause: Record<string, unknown> = {};
  if (!force) {
    whereClause.biography = null;
  }

  let politicians = await db.politician.findMany({
    where: whereClause,
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      civility: true,
      birthDate: true,
      birthPlace: true,
      deathDate: true,
      currentParty: { select: { name: true } },
      mandates: {
        select: {
          type: true,
          title: true,
          institution: true,
          isCurrent: true,
          startDate: true,
          endDate: true,
        },
        orderBy: { startDate: "desc" },
      },
      declarations: {
        select: { year: true },
        orderBy: { year: "desc" },
      },
      _count: { select: { affairs: true, votes: true } },
    },
  });

  if (limit) {
    politicians = politicians.slice(0, limit);
  }

  console.log(`Found ${politicians.length} politicians to process`);

  if (politicians.length === 0) {
    return stats;
  }

  // Get vote stats
  const voteStatsByPolitician = new Map<
    string,
    { total: number; pour: number; contre: number; abstention: number }
  >();

  const voteStats = await db.vote.groupBy({
    by: ["politicianId", "position"],
    _count: true,
  });

  for (const vs of voteStats) {
    const existing = voteStatsByPolitician.get(vs.politicianId) || {
      total: 0,
      pour: 0,
      contre: 0,
      abstention: 0,
    };
    existing.total += vs._count;
    switch (vs.position) {
      case "POUR":
        existing.pour += vs._count;
        break;
      case "CONTRE":
        existing.contre += vs._count;
        break;
      case "ABSTENTION":
        existing.abstention += vs._count;
        break;
    }
    voteStatsByPolitician.set(vs.politicianId, existing);
  }

  for (let i = 0; i < politicians.length; i++) {
    const pol = politicians[i];

    try {
      const bioRequest: BiographyRequest = {
        fullName: pol!.fullName,
        civility: pol!.civility,
        birthDate: pol!.birthDate,
        birthPlace: pol!.birthPlace,
        deathDate: pol!.deathDate,
        currentParty: pol!.currentParty?.name || null,
        mandates: pol!.mandates.map((m) => ({
          type: m.type,
          title: mandateTitle(m),
          isCurrent: m.isCurrent,
          startDate: m.startDate,
          endDate: m.endDate,
        })),
        voteStats: voteStatsByPolitician.get(pol!.id) || null,
        affairsCount: pol!._count.affairs,
        declarationsCount: pol!.declarations.length,
        latestDeclarationYear: pol!.declarations.length > 0 ? pol!.declarations[0]!.year : null,
      };

      const biography = await generateBiography(bioRequest);

      await db.politician.update({
        where: { id: pol!.id },
        data: {
          biography,
          biographyGeneratedAt: new Date(),
        },
      });

      stats.generated++;
      stats.processed++;

      if (i < politicians.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, AI_RATE_LIMIT_MS));
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      stats.errors.push(`${pol!.fullName}: ${errorMsg}`);
      stats.processed++;

      if (errorMsg.includes("429") || errorMsg.includes("rate")) {
        console.log("Rate limited, waiting 30s...");
        await new Promise((resolve) => setTimeout(resolve, AI_429_BACKOFF_MS));
      }
    }
  }

  return stats;
}
