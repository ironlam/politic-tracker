#!/usr/bin/env tsx
/**
 * Data Quality Investigation Script
 *
 * Investigates specific data quality issues:
 * 1. Date range of Sénat votes
 * 2. Raphaël Glucksmann's data (MEP, should not have AN votes)
 * 3. Julien Sanchez article (incorrectly linked to Spain news?)
 * 4. Press articles without mentions
 *
 * Usage:
 *   npx tsx scripts/investigate-data.ts
 */

import "dotenv/config";
import { db } from "../src/lib/db";

async function investigateSenatVotes() {
  console.log("\n" + "=".repeat(60));
  console.log("1. SÉNAT VOTES DATE RANGE");
  console.log("=".repeat(60));

  // Get date range by chamber
  const dateRanges = await db.$queryRaw<
    Array<{
      chamber: string;
      min_date: Date;
      max_date: Date;
      count: bigint;
    }>
  >`
    SELECT
      chamber,
      MIN("votingDate") as min_date,
      MAX("votingDate") as max_date,
      COUNT(*) as count
    FROM "Scrutin"
    GROUP BY chamber
    ORDER BY chamber
  `;

  console.log("\nDate range of scrutins by chamber:");
  for (const row of dateRanges) {
    const minYear = row.min_date.getFullYear();
    const maxYear = row.max_date.getFullYear();
    console.log(
      `  ${row.chamber}: ${minYear}-${row.min_date.getMonth() + 1}-${row.min_date.getDate()} to ${maxYear}-${row.max_date.getMonth() + 1}-${row.max_date.getDate()} (${row.count} scrutins)`
    );
  }

  // Get year breakdown for SENAT
  const senatByYear = await db.$queryRaw<
    Array<{
      year: number;
      count: bigint;
    }>
  >`
    SELECT
      EXTRACT(YEAR FROM "votingDate")::int as year,
      COUNT(*) as count
    FROM "Scrutin"
    WHERE chamber = 'SENAT'
    GROUP BY EXTRACT(YEAR FROM "votingDate")
    ORDER BY year
  `;

  console.log("\nSénat scrutins by year:");
  for (const row of senatByYear) {
    console.log(`  ${row.year}: ${row.count} scrutins`);
  }
}

async function investigateRaphaelGlucksmann() {
  console.log("\n" + "=".repeat(60));
  console.log("2. RAPHAËL GLUCKSMANN DATA");
  console.log("=".repeat(60));

  // Find Glucksmann
  const glucksmann = await db.politician.findFirst({
    where: {
      OR: [
        { fullName: { contains: "Glucksmann", mode: "insensitive" } },
        { lastName: { contains: "Glucksmann", mode: "insensitive" } },
      ],
    },
    include: {
      mandates: {
        orderBy: { startDate: "desc" },
      },
      currentParty: true,
      votes: {
        take: 5,
        include: {
          scrutin: {
            select: {
              title: true,
              chamber: true,
              votingDate: true,
            },
          },
        },
      },
      externalIds: true,
    },
  });

  if (!glucksmann) {
    console.log("\n  Raphaël Glucksmann NOT FOUND in database");

    // Check if there are any similar names
    const similar = await db.politician.findMany({
      where: {
        OR: [
          { lastName: { startsWith: "Gluck", mode: "insensitive" } },
          { fullName: { contains: "Raphael", mode: "insensitive" } },
        ],
      },
      select: { fullName: true, slug: true },
      take: 5,
    });

    if (similar.length > 0) {
      console.log("  Similar names found:");
      for (const p of similar) {
        console.log(`    - ${p.fullName} (${p.slug})`);
      }
    }
    return;
  }

  console.log(`\n  Found: ${glucksmann.fullName}`);
  console.log(`  Slug: ${glucksmann.slug}`);
  console.log(`  Current party: ${glucksmann.currentParty?.name || "None"}`);

  console.log("\n  Mandates:");
  for (const m of glucksmann.mandates) {
    const status = m.isCurrent ? "[CURRENT]" : "";
    const group = m.europeanGroupCode ? `(${m.europeanGroupCode})` : "";
    console.log(
      `    - ${m.type}: ${m.title} ${group} ${status}`
    );
    console.log(
      `      ${m.startDate?.toISOString().slice(0, 10) || "?"} -> ${m.endDate?.toISOString().slice(0, 10) || "ongoing"}`
    );
  }

  console.log("\n  External IDs:");
  for (const ext of glucksmann.externalIds) {
    console.log(`    - ${ext.source}: ${ext.externalId}`);
  }

  console.log(`\n  Votes: ${glucksmann.votes.length} total`);
  if (glucksmann.votes.length > 0) {
    console.log("  Sample votes:");
    for (const v of glucksmann.votes) {
      console.log(
        `    - [${v.scrutin.chamber}] ${v.scrutin.votingDate.toISOString().slice(0, 10)}: ${v.scrutin.title.slice(0, 60)}...`
      );
    }

    // Check if he has AN votes (he shouldn't as MEP)
    const anVotes = await db.vote.count({
      where: {
        politicianId: glucksmann.id,
        scrutin: { chamber: "AN" },
      },
    });
    const senatVotes = await db.vote.count({
      where: {
        politicianId: glucksmann.id,
        scrutin: { chamber: "SENAT" },
      },
    });

    console.log(`\n  Vote breakdown:`);
    console.log(`    - AN votes: ${anVotes}`);
    console.log(`    - SENAT votes: ${senatVotes}`);

    if (anVotes > 0 || senatVotes > 0) {
      console.log(`\n  ⚠️  WARNING: MEP has national parliament votes!`);
    }
  }
}

async function investigateJulienSanchezArticle() {
  console.log("\n" + "=".repeat(60));
  console.log("3. JULIEN SANCHEZ PRESS ARTICLES");
  console.log("=".repeat(60));

  // Find articles mentioning Sanchez
  const sanchezArticles = await db.pressArticle.findMany({
    where: {
      OR: [
        { title: { contains: "Sanchez", mode: "insensitive" } },
        { description: { contains: "Sanchez", mode: "insensitive" } },
      ],
    },
    include: {
      mentions: {
        include: {
          politician: {
            select: { fullName: true, slug: true },
          },
        },
      },
      partyMentions: {
        include: {
          party: {
            select: { name: true, shortName: true },
          },
        },
      },
    },
    orderBy: { publishedAt: "desc" },
    take: 20,
  });

  console.log(`\nFound ${sanchezArticles.length} articles with "Sanchez" in title/description:\n`);

  for (const article of sanchezArticles) {
    console.log(`  [${article.feedSource}] ${article.publishedAt.toISOString().slice(0, 10)}`);
    console.log(`  Title: ${article.title.slice(0, 100)}...`);
    console.log(`  URL: ${article.url}`);

    if (article.mentions.length > 0) {
      console.log(`  Politician mentions:`);
      for (const m of article.mentions) {
        console.log(`    - ${m.politician.fullName} (matched: "${m.matchedName}")`);
      }
    } else {
      console.log(`  Politician mentions: NONE`);
    }

    if (article.partyMentions.length > 0) {
      console.log(`  Party mentions:`);
      for (const m of article.partyMentions) {
        console.log(`    - ${m.party.name} (matched: "${m.matchedName}")`);
      }
    }

    // Check if this is about Spain (Pedro Sánchez)
    const spainIndicators = ["Espagne", "espagnol", "Pedro", "Madrid", "Spain", "Spanish"];
    const hasSpainIndicator = spainIndicators.some(
      (ind) =>
        article.title.toLowerCase().includes(ind.toLowerCase()) ||
        (article.description || "").toLowerCase().includes(ind.toLowerCase())
    );

    if (hasSpainIndicator) {
      console.log(`  ⚠️  LIKELY ABOUT SPAIN (not French Julien Sanchez)`);
    }

    console.log("");
  }

  // Also check if there's a French politician named Julien Sanchez
  const julienSanchez = await db.politician.findFirst({
    where: {
      fullName: { contains: "Julien Sanchez", mode: "insensitive" },
    },
    include: {
      mandates: { where: { isCurrent: true } },
      currentParty: true,
    },
  });

  if (julienSanchez) {
    console.log("  French politician found: Julien Sanchez");
    console.log(`    Party: ${julienSanchez.currentParty?.name || "None"}`);
    console.log(`    Current mandates: ${julienSanchez.mandates.map((m) => m.type).join(", ")}`);
  } else {
    console.log("  No French politician named 'Julien Sanchez' in database");
  }
}

async function investigateArticlesWithoutMentions() {
  console.log("\n" + "=".repeat(60));
  console.log("4. PRESS ARTICLES WITHOUT MENTIONS");
  console.log("=".repeat(60));

  const totalArticles = await db.pressArticle.count();

  const articlesWithPoliticianMentions = await db.pressArticle.count({
    where: {
      mentions: { some: {} },
    },
  });

  const articlesWithPartyMentions = await db.pressArticle.count({
    where: {
      partyMentions: { some: {} },
    },
  });

  const articlesWithAnyMention = await db.pressArticle.count({
    where: {
      OR: [{ mentions: { some: {} } }, { partyMentions: { some: {} } }],
    },
  });

  const articlesWithNoMentions = totalArticles - articlesWithAnyMention;

  console.log(`\n  Total press articles: ${totalArticles}`);
  console.log(`  With politician mentions: ${articlesWithPoliticianMentions} (${((articlesWithPoliticianMentions / totalArticles) * 100).toFixed(1)}%)`);
  console.log(`  With party mentions: ${articlesWithPartyMentions} (${((articlesWithPartyMentions / totalArticles) * 100).toFixed(1)}%)`);
  console.log(`  With any mention: ${articlesWithAnyMention} (${((articlesWithAnyMention / totalArticles) * 100).toFixed(1)}%)`);
  console.log(`  With NO mentions: ${articlesWithNoMentions} (${((articlesWithNoMentions / totalArticles) * 100).toFixed(1)}%)`);

  // Sample of articles without mentions
  const sampleNoMentions = await db.pressArticle.findMany({
    where: {
      mentions: { none: {} },
      partyMentions: { none: {} },
    },
    select: {
      feedSource: true,
      title: true,
      publishedAt: true,
    },
    orderBy: { publishedAt: "desc" },
    take: 10,
  });

  console.log("\n  Sample articles with NO mentions:");
  for (const article of sampleNoMentions) {
    console.log(`    [${article.feedSource}] ${article.publishedAt.toISOString().slice(0, 10)}: ${article.title.slice(0, 70)}...`);
  }

  // Breakdown by source
  const bySource = await db.$queryRaw<
    Array<{
      feedSource: string;
      total: bigint;
      with_mentions: bigint;
    }>
  >`
    SELECT
      pa."feedSource",
      COUNT(*) as total,
      COUNT(CASE WHEN EXISTS (
        SELECT 1 FROM "PressArticleMention" pam WHERE pam."articleId" = pa.id
      ) OR EXISTS (
        SELECT 1 FROM "PressArticlePartyMention" papm WHERE papm."articleId" = pa.id
      ) THEN 1 END) as with_mentions
    FROM "PressArticle" pa
    GROUP BY pa."feedSource"
    ORDER BY total DESC
  `;

  console.log("\n  Breakdown by source:");
  for (const row of bySource) {
    const pct = Number(row.total) > 0
      ? ((Number(row.with_mentions) / Number(row.total)) * 100).toFixed(1)
      : "0.0";
    console.log(
      `    ${row.feedSource}: ${row.with_mentions}/${row.total} with mentions (${pct}%)`
    );
  }
}

async function main() {
  console.log("\n📊 Data Quality Investigation");
  console.log("Generated: " + new Date().toISOString());

  await investigateSenatVotes();
  await investigateRaphaelGlucksmann();
  await investigateJulienSanchezArticle();
  await investigateArticlesWithoutMentions();

  console.log("\n" + "=".repeat(60));
  console.log("Investigation complete.");
  console.log("=".repeat(60) + "\n");
}

main()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
