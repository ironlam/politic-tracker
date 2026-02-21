/**
 * Publication status assignment service.
 *
 * Assigns PUBLISHED / DRAFT / ARCHIVED / EXCLUDED status to politicians
 * based on prominence rules. See rules in config/prominence.ts STATUS_RULES.
 */

import { db } from "@/lib/db";
import { PublicationStatus } from "@/generated/prisma";
import { STATUS_RULES } from "@/config/prominence";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PublicationStatusOptions {
  dryRun?: boolean;
}

export interface PublicationStatusStats {
  totalPoliticians: number;
  skippedOverride: number;
  unchanged: number;
  changes: Record<string, number>;
}

type PoliticianRow = {
  id: string;
  birthDate: Date | null;
  deathDate: Date | null;
  photoUrl: string | null;
  biography: string | null;
  publicationStatus: PublicationStatus;
  statusOverride: boolean;
  prominenceScore: number;
  hasCurrentMandate: boolean;
};

// ---------------------------------------------------------------------------
// Status determination
// ---------------------------------------------------------------------------

function determineStatus(p: PoliticianRow): PublicationStatus | null {
  // Rule 1: Manual override — don't touch
  if (p.statusOverride) return null;

  const now = new Date();

  // Rule 2: Deceased before 1958 → EXCLUDED
  if (p.deathDate && p.deathDate.getFullYear() < STATUS_RULES.excludeDeathBeforeYear) {
    return PublicationStatus.EXCLUDED;
  }

  // Rule 3: Born before 1920 AND no current mandate AND low score → EXCLUDED
  if (
    p.birthDate &&
    p.birthDate.getFullYear() < STATUS_RULES.excludeBornBeforeYear &&
    !p.hasCurrentMandate &&
    p.prominenceScore < STATUS_RULES.publishThreshold
  ) {
    return PublicationStatus.EXCLUDED;
  }

  // Rule 4: Has current mandate → PUBLISHED
  if (p.hasCurrentMandate) return PublicationStatus.PUBLISHED;

  // Rule 5: High prominence AND has minimum data → PUBLISHED
  if (p.prominenceScore >= STATUS_RULES.publishThreshold) {
    if (!STATUS_RULES.minDataForPublished || p.photoUrl || p.biography) {
      return PublicationStatus.PUBLISHED;
    }
  }

  // Rule 6: Deceased > 10 years → ARCHIVED
  if (p.deathDate) {
    const yearsDeceased = (now.getTime() - p.deathDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (yearsDeceased > STATUS_RULES.archiveDeathYears) {
      return PublicationStatus.ARCHIVED;
    }
  }

  // Rule 7: Low score AND no current mandate → ARCHIVED
  if (p.prominenceScore < STATUS_RULES.archiveScoreThreshold && !p.hasCurrentMandate) {
    return PublicationStatus.ARCHIVED;
  }

  // Rule 8: Default → DRAFT
  return PublicationStatus.DRAFT;
}

// ---------------------------------------------------------------------------
// Main service
// ---------------------------------------------------------------------------

export async function assignPublicationStatus(
  options: PublicationStatusOptions = {}
): Promise<PublicationStatusStats> {
  const { dryRun = false } = options;

  const politicians = await db.politician.findMany({
    select: {
      id: true,
      birthDate: true,
      deathDate: true,
      photoUrl: true,
      biography: true,
      publicationStatus: true,
      statusOverride: true,
      prominenceScore: true,
      mandates: {
        where: { isCurrent: true },
        select: { id: true },
        take: 1,
      },
    },
  });

  const changes: Map<PublicationStatus, string[]> = new Map();
  let skippedOverride = 0;
  let unchanged = 0;

  for (const p of politicians) {
    const row: PoliticianRow = {
      id: p.id,
      birthDate: p.birthDate,
      deathDate: p.deathDate,
      photoUrl: p.photoUrl,
      biography: p.biography,
      publicationStatus: p.publicationStatus,
      statusOverride: p.statusOverride,
      prominenceScore: p.prominenceScore,
      hasCurrentMandate: p.mandates.length > 0,
    };

    const targetStatus = determineStatus(row);

    if (targetStatus === null) {
      skippedOverride++;
      continue;
    }

    if (targetStatus === p.publicationStatus) {
      unchanged++;
      continue;
    }

    const ids = changes.get(targetStatus) ?? [];
    ids.push(p.id);
    changes.set(targetStatus, ids);
  }

  // Apply batch updates
  if (!dryRun) {
    for (const [status, ids] of changes) {
      await db.politician.updateMany({
        where: { id: { in: ids } },
        data: { publicationStatus: status },
      });
    }
  }

  const changeStats: Record<string, number> = {};
  for (const [status, ids] of changes) {
    changeStats[status] = ids.length;
  }

  return {
    totalPoliticians: politicians.length,
    skippedOverride,
    unchanged,
    changes: changeStats,
  };
}
