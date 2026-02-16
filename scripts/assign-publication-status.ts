/**
 * Assign publication status to all politicians based on prominence rules.
 *
 * Rules (in priority order):
 *   1. statusOverride = true → skip (manual override)
 *   2. Deceased before 1958 → EXCLUDED
 *   3. Born before 1920 AND no current mandate AND low score → EXCLUDED
 *   4. Has current mandate → PUBLISHED
 *   5. prominenceScore >= 150 AND has photo or biography → PUBLISHED
 *   6. Deceased > 10 years → ARCHIVED
 *   7. prominenceScore < 50 AND no current mandate → ARCHIVED
 *   8. Otherwise → DRAFT
 *
 * Usage:
 *   npx tsx scripts/assign-publication-status.ts              # Apply changes
 *   npx tsx scripts/assign-publication-status.ts --dry-run    # Preview only
 */
import "dotenv/config";
import { PrismaClient, PublicationStatus } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { STATUS_RULES } from "../src/config/prominence";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const dryRun = process.argv.includes("--dry-run");

type PoliticianRow = {
  id: string;
  fullName: string;
  birthDate: Date | null;
  deathDate: Date | null;
  photoUrl: string | null;
  biography: string | null;
  publicationStatus: PublicationStatus;
  statusOverride: boolean;
  prominenceScore: number;
  hasCurrentMandate: boolean;
};

/**
 * Determine the target publication status for a politician.
 * Returns null if the politician should be skipped (statusOverride).
 */
function determineStatus(p: PoliticianRow): PublicationStatus | null {
  // Rule 1: Manual override — don't touch
  if (p.statusOverride) {
    return null;
  }

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
  if (p.hasCurrentMandate) {
    return PublicationStatus.PUBLISHED;
  }

  // Rule 5: High prominence AND has minimum data (photo or biography) → PUBLISHED
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

async function main() {
  console.log("=".repeat(60));
  console.log("Assign Publication Status");
  console.log("=".repeat(60));
  if (dryRun) {
    console.log("[DRY-RUN] No changes will be written to the database.\n");
  }

  // Fetch all politicians with their current mandate status
  const politicians = await db.politician.findMany({
    select: {
      id: true,
      fullName: true,
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

  console.log(`Total politicians: ${politicians.length}\n`);

  // Compute target status for each politician
  const changes: Map<PublicationStatus, string[]> = new Map();
  let skippedOverride = 0;
  let unchanged = 0;

  const sampleChanges: Array<{
    name: string;
    from: PublicationStatus;
    to: PublicationStatus;
  }> = [];

  for (const p of politicians) {
    const row: PoliticianRow = {
      id: p.id,
      fullName: p.fullName,
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

    // Record change
    const ids = changes.get(targetStatus) ?? [];
    ids.push(p.id);
    changes.set(targetStatus, ids);

    // Keep sample changes (max 5 per status)
    const samplesForStatus = sampleChanges.filter((s) => s.to === targetStatus);
    if (samplesForStatus.length < 5) {
      sampleChanges.push({
        name: p.fullName,
        from: p.publicationStatus,
        to: targetStatus,
      });
    }
  }

  // Show distribution stats
  console.log("--- Status Distribution (before) ---");
  const beforeCounts: Record<string, number> = {};
  for (const p of politicians) {
    beforeCounts[p.publicationStatus] = (beforeCounts[p.publicationStatus] ?? 0) + 1;
  }
  for (const [status, count] of Object.entries(beforeCounts).sort()) {
    console.log(`  ${status}: ${count}`);
  }

  console.log(`\n--- Changes ---`);
  console.log(`  Skipped (statusOverride): ${skippedOverride}`);
  console.log(`  Unchanged: ${unchanged}`);

  let totalChanges = 0;
  for (const [status, ids] of changes) {
    console.log(`  → ${status}: ${ids.length}`);
    totalChanges += ids.length;
  }
  console.log(`  Total changes: ${totalChanges}`);

  // Show sample changes
  if (sampleChanges.length > 0) {
    console.log(`\n--- Sample Changes ---`);
    for (const s of sampleChanges) {
      console.log(`  ${s.name}: ${s.from} → ${s.to}`);
    }
  }

  // Apply batch updates
  if (!dryRun && totalChanges > 0) {
    console.log(`\n--- Applying ${totalChanges} changes ---`);

    for (const [status, ids] of changes) {
      const result = await db.politician.updateMany({
        where: { id: { in: ids } },
        data: { publicationStatus: status },
      });
      console.log(`  ${status}: ${result.count} updated`);
    }

    console.log("\nDone!");
  } else if (dryRun) {
    console.log("\n[DRY-RUN] No changes applied.");
  } else {
    console.log("\nNo changes needed.");
  }

  // Show projected distribution (after)
  // Build a lookup: politician ID → target status
  const targetByPolitician = new Map<string, PublicationStatus>();
  for (const [status, ids] of changes) {
    for (const id of ids) {
      targetByPolitician.set(id, status);
    }
  }

  console.log("\n--- Status Distribution (projected) ---");
  const afterCounts: Record<string, number> = {};
  for (const p of politicians) {
    const finalStatus = targetByPolitician.get(p.id) ?? p.publicationStatus;
    afterCounts[finalStatus] = (afterCounts[finalStatus] ?? 0) + 1;
  }
  for (const [status, count] of Object.entries(afterCounts).sort()) {
    console.log(`  ${status}: ${count}`);
  }
}

main()
  .catch(console.error)
  .finally(() => {
    db.$disconnect();
    pool.end();
  });
