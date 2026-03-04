/**
 * Migration script: Update affair slugs to include politician name.
 *
 * Before: contournement-d-embauche-familiale
 * After:  marine-le-pen-contournement-embauche-familiale
 *
 * Usage:
 *   npx dotenv -e .env -- npx tsx scripts/migrate-affair-slugs.ts --dry-run
 *   npx dotenv -e .env -- npx tsx scripts/migrate-affair-slugs.ts
 */

import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { generateAffairSlug, generateSlug } from "../src/lib/utils";

const dryRun = process.argv.includes("--dry-run");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  ssl: { rejectUnauthorized: false },
  allowExitOnIdle: true,
});
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  console.log(dryRun ? "=== DRY RUN ===" : "=== LIVE MIGRATION ===");

  const affairs = await db.affair.findMany({
    select: {
      id: true,
      title: true,
      slug: true,
      oldSlugs: true,
      politician: { select: { slug: true, fullName: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`${affairs.length} affairs to process\n`);

  let changed = 0;
  let skipped = 0;
  let collisions = 0;

  // Track new slugs to detect collisions within this batch
  const usedSlugs = new Set<string>();

  for (const affair of affairs) {
    const politicianSlug = affair.politician?.slug ?? "";
    const newBaseSlug = generateAffairSlug(politicianSlug, affair.title);

    // Check if slug already starts with politician name
    const politicianPrefix = generateSlug(politicianSlug);
    if (affair.slug.startsWith(politicianPrefix + "-") && !affair.slug.startsWith("a-verifier")) {
      skipped++;
      continue;
    }

    // If the new slug is the same as current, skip
    if (newBaseSlug === affair.slug) {
      skipped++;
      continue;
    }

    // Handle uniqueness: check DB + batch
    let newSlug = newBaseSlug;
    let counter = 2;
    while (
      usedSlugs.has(newSlug) ||
      (await db.affair.findFirst({ where: { slug: newSlug, id: { not: affair.id } } }))
    ) {
      const suffix = `-${counter}`;
      newSlug = newBaseSlug.slice(0, 120 - suffix.length).replace(/-$/, "") + suffix;
      counter++;
      collisions++;
    }

    usedSlugs.add(newSlug);

    if (dryRun) {
      console.log(`[${affair.politician?.fullName}]`);
      console.log(`  OLD: ${affair.slug}`);
      console.log(`  NEW: ${newSlug}`);
      console.log();
    } else {
      // Preserve current slug in oldSlugs for 301 redirect
      const updatedOldSlugs = affair.oldSlugs.includes(affair.slug)
        ? affair.oldSlugs
        : [...affair.oldSlugs, affair.slug];

      await db.affair.update({
        where: { id: affair.id },
        data: {
          slug: newSlug,
          oldSlugs: updatedOldSlugs,
        },
      });
    }

    changed++;
  }

  console.log("---");
  console.log(`Changed: ${changed}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Collisions resolved: ${collisions}`);
  console.log(dryRun ? "\nRe-run without --dry-run to apply." : "\nDone!");
}

main()
  .catch(console.error)
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
