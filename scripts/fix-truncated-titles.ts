/**
 * Fix truncated fact-check titles by fetching the real title from source URLs.
 *
 * The Google Fact Check API often returns truncated titles (ending with "...").
 * This script scrapes the source page to get the full og:title or <title>.
 *
 * Usage:
 *   npx tsx scripts/fix-truncated-titles.ts              # Fix all truncated titles
 *   npx tsx scripts/fix-truncated-titles.ts --dry-run    # Preview without saving
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { fetchPageTitle } from "../src/lib/api/factcheck";
import { generateDateSlug } from "../src/lib/utils";

const db = new PrismaClient();
const isDryRun = process.argv.includes("--dry-run");

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  // Find all fact-checks with truncated titles
  const truncated = await db.factCheck.findMany({
    where: {
      OR: [{ title: { endsWith: "..." } }, { title: { endsWith: "\u2026" } }],
    },
    select: { id: true, title: true, sourceUrl: true, slug: true, publishedAt: true },
  });

  console.log(`Found ${truncated.length} fact-checks with truncated titles\n`);

  let fixed = 0;
  let failed = 0;

  for (const fc of truncated) {
    const fullTitle = await fetchPageTitle(fc.sourceUrl, fc.title);

    if (fullTitle !== fc.title) {
      // Also regenerate the slug from the full title
      const newSlug = generateDateSlug(fc.publishedAt, fullTitle);

      // Check for slug collision
      const existing = await db.factCheck.findUnique({ where: { slug: newSlug } });
      const slugToUse = existing && existing.id !== fc.id ? fc.slug : newSlug;

      if (isDryRun) {
        console.log(`  ~ TITLE: "${fc.title}"`);
        console.log(`       → "${fullTitle}"`);
        if (slugToUse !== fc.slug) {
          console.log(`    SLUG: ${fc.slug} → ${slugToUse}`);
        }
        console.log();
      } else {
        await db.factCheck.update({
          where: { id: fc.id },
          data: {
            title: fullTitle,
            ...(slugToUse !== fc.slug ? { slug: slugToUse } : {}),
          },
        });
        console.log(`  ✓ "${fc.title}" → "${fullTitle}"`);
      }
      fixed++;
    } else {
      console.log(`  ✗ Could not fetch full title for: ${fc.sourceUrl}`);
      failed++;
    }

    // Rate limiting between fetches
    await sleep(1000);
  }

  console.log(
    `\n${isDryRun ? "Would fix" : "Fixed"} ${fixed}/${truncated.length} titles (${failed} failed)`
  );
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
