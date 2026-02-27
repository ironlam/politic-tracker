/**
 * Fix published affairs with no dates.
 * Extracts dates from source URLs and sets startDate (revelation date).
 * For condamnation/relaxe statuses, also sets verdictDate from the most relevant source.
 *
 * Usage: npx dotenv -e .env -- npx tsx scripts/fix-affair-dates.ts
 */
import { db } from "../src/lib/db";

// URL date extraction patterns
function extractDateFromUrl(url: string): Date | null {
  // Skip Wikipedia URLs
  if (url.includes("wikipedia.org")) return null;

  // Pattern: /article/YYYY/MM/DD/ (lemonde, huffpost)
  let match = url.match(/\/article\/(\d{4})\/(\d{2})\/(\d{2})\//);
  if (match) return new Date(`${match[1]}-${match[2]}-${match[3]}`);

  // Pattern: /YYYY/MM/DD/ (huffpost, various)
  match = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
  if (match) {
    const y = parseInt(match[1]);
    if (y >= 2000 && y <= 2030) return new Date(`${match[1]}-${match[2]}-${match[3]}`);
  }

  // Pattern: -YYYYMMDD_ or -YYYYMMDD- (liberation, france24)
  match = url.match(/[-/](\d{4})(\d{2})(\d{2})[_\-/.]/);
  if (match) {
    const y = parseInt(match[1]);
    if (y >= 2000 && y <= 2030) return new Date(`${match[1]}-${match[2]}-${match[3]}`);
  }

  // Pattern: DD-MM-YYYY- (leparisien)
  match = url.match(/(\d{2})-(\d{2})-(\d{4})-/);
  if (match) {
    const y = parseInt(match[3]);
    if (y >= 2000 && y <= 2030) return new Date(`${match[3]}-${match[2]}-${match[1]}`);
  }

  // Pattern: /DDMMYY/ (mediapart old)
  match = url.match(/\/(\d{2})(\d{2})(\d{2})\//);
  if (match) {
    const y = parseInt(match[3]);
    if (y >= 0 && y <= 30) {
      const fullYear = 2000 + y;
      return new Date(`${fullYear}-${match[2]}-${match[1]}`);
    }
  }

  return null;
}

// Statuses that imply a verdict date exists
const VERDICT_STATUSES = [
  "CONDAMNATION_DEFINITIVE",
  "CONDAMNATION_PREMIERE_INSTANCE",
  "RELAXE",
  "PRESCRIPTION",
  "APPEL_EN_COURS",
];

async function main() {
  const affairs = await db.affair.findMany({
    where: {
      publicationStatus: "PUBLISHED",
      factsDate: null,
      startDate: null,
      verdictDate: null,
    },
    select: {
      id: true,
      title: true,
      status: true,
      sources: true,
    },
    orderBy: { title: "asc" },
  });

  console.log(`Found ${affairs.length} published affairs with no dates\n`);

  let updated = 0;
  let skipped = 0;

  for (const affair of affairs) {
    const sources = Array.isArray(affair.sources)
      ? (affair.sources as { url?: string; title?: string }[])
      : [];
    const urls = sources.filter((s) => s.url).map((s) => s.url!);

    // Extract dates from all source URLs
    const datePairs: { date: Date; url: string }[] = [];
    for (const url of urls) {
      const d = extractDateFromUrl(url);
      if (d && !isNaN(d.getTime())) {
        datePairs.push({ date: d, url });
      }
    }

    if (datePairs.length === 0) {
      console.log(`SKIP: ${affair.title}`);
      console.log(`  No dates found in ${urls.length} URLs`);
      skipped++;
      continue;
    }

    // Sort by date ascending
    datePairs.sort((a, b) => a.date.getTime() - b.date.getTime());

    // startDate = earliest source date (revelation date)
    const startDate = datePairs[0].date;

    // verdictDate = latest source date IF the status implies a verdict
    const hasVerdict = VERDICT_STATUSES.includes(affair.status);
    const verdictDate =
      hasVerdict && datePairs.length > 1 ? datePairs[datePairs.length - 1].date : null;

    // Don't set verdictDate if it's the same as startDate
    const finalVerdictDate =
      verdictDate && verdictDate.getTime() !== startDate.getTime() ? verdictDate : null;

    const updateData: { startDate: Date; verdictDate?: Date } = { startDate };
    if (finalVerdictDate) updateData.verdictDate = finalVerdictDate;

    console.log(`UPDATE: ${affair.title}`);
    console.log(
      `  startDate: ${startDate.toISOString().split("T")[0]} (from ${datePairs[0].url.substring(0, 80)}...)`
    );
    if (finalVerdictDate) {
      console.log(
        `  verdictDate: ${finalVerdictDate.toISOString().split("T")[0]} (status: ${affair.status})`
      );
    }

    await db.affair.update({
      where: { id: affair.id },
      data: updateData,
    });

    updated++;
  }

  console.log(`\n--- Summary ---`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (no date in URLs): ${skipped}`);

  // Re-check: how many still have no dates?
  const remaining = await db.affair.count({
    where: {
      publicationStatus: "PUBLISHED",
      factsDate: null,
      startDate: null,
      verdictDate: null,
    },
  });
  console.log(`Remaining without dates: ${remaining}`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
