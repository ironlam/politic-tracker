/**
 * Re-generate factcheck slugs with the improved generateDateSlug (120 chars, word-boundary truncation).
 * Only updates slugs that were previously truncated (different from the new generation).
 *
 * Usage: npx tsx scripts/migrate-factcheck-slugs-v2.ts [--dry-run]
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { generateDateSlug } from "../src/lib/utils";

const db = new PrismaClient();
const isDryRun = process.argv.includes("--dry-run");

async function main() {
  const factChecks = await db.factCheck.findMany({
    where: { slug: { not: null } },
    select: { id: true, slug: true, title: true, publishedAt: true },
  });

  console.log(`Found ${factChecks.length} fact-checks with slugs`);
  let updated = 0;

  for (const fc of factChecks) {
    const newSlug = generateDateSlug(fc.publishedAt, fc.title);

    if (newSlug !== fc.slug) {
      // Check for collision
      const existing = await db.factCheck.findUnique({ where: { slug: newSlug } });
      if (existing && existing.id !== fc.id) {
        console.log(`  ⚠ SKIP ${fc.slug} → ${newSlug} (collision with ${existing.id})`);
        continue;
      }

      if (isDryRun) {
        console.log(`  ~ ${fc.slug} → ${newSlug}`);
      } else {
        await db.factCheck.update({ where: { id: fc.id }, data: { slug: newSlug } });
        console.log(`  ✓ ${fc.slug} → ${newSlug}`);
      }
      updated++;
    }
  }

  console.log(`\n${isDryRun ? "Would update" : "Updated"} ${updated}/${factChecks.length} slugs`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
