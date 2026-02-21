/**
 * CLI script to sync press articles from RSS feeds
 *
 * Fetches RSS feeds from configured news sources and matches mentioned politicians.
 *
 * Usage:
 *   npm run sync:press              # Sync all configured feeds
 *   npm run sync:press -- --stats   # Show current stats
 *   npm run sync:press -- --dry-run # Preview without saving
 *   npm run sync:press -- --limit=50 # Limit articles per feed
 *   npm run sync:press -- --feed=lemonde # Sync specific feed only
 */

import "dotenv/config";
import { createCLI, ProgressTracker, type SyncHandler, type SyncResult } from "../src/lib/sync";
import { RSS_FEEDS } from "../src/lib/api";
import { db } from "../src/lib/db";
import { syncPress as syncPressService } from "../src/services/sync/press";
import { buildPartyIndex, findPartyMentions } from "../src/lib/name-matching";

// ============================================
// SYNC HANDLER
// ============================================

const handler: SyncHandler = {
  name: "Politic Tracker - Press Sync (RSS)",
  description: "Syncs press articles from RSS feeds and matches politicians",

  options: [
    {
      name: "--feed",
      type: "string",
      description: "Sync specific feed only (lemonde, politico, mediapart)",
    },
    {
      name: "--reindex-parties",
      type: "boolean",
      description: "Reindex party mentions on existing articles",
    },
  ],

  showHelp() {
    console.log(`
Politic Tracker - Press Sync (RSS)

Fetches articles from RSS feeds and links them to politicians.

Data sources:
${RSS_FEEDS.map((f) => `  - ${f.name} (${f.url})`).join("\n")}

Matching strategy:
  1. Normalize text (lowercase, remove accents)
  2. Match full names first (more specific)
  3. Match last names with word boundaries (4+ chars)

Options:
  --stats            Show current statistics
  --dry-run          Preview changes without saving
  --limit=N          Limit articles per feed
  --feed=ID          Sync specific feed only
  --reindex-parties  Reindex party mentions on existing articles
    `);
  },

  async showStats() {
    const [
      totalArticles,
      articlesBySource,
      totalMentions,
      totalPartyMentions,
      topMentioned,
      topMentionedParties,
      recentArticles,
    ] = await Promise.all([
      db.pressArticle.count(),
      db.pressArticle.groupBy({
        by: ["feedSource"],
        _count: true,
        orderBy: { _count: { feedSource: "desc" } },
      }),
      db.pressArticleMention.count(),
      db.pressArticlePartyMention.count(),
      db.$queryRaw<Array<{ fullName: string; count: bigint }>>`
        SELECT p."fullName", COUNT(*) as count
        FROM "PressArticleMention" m
        JOIN "Politician" p ON m."politicianId" = p.id
        GROUP BY p.id, p."fullName"
        ORDER BY count DESC
        LIMIT 10
      `,
      db.$queryRaw<Array<{ name: string; shortName: string; count: bigint }>>`
        SELECT p.name, p."shortName", COUNT(*) as count
        FROM "PressArticlePartyMention" m
        JOIN "Party" p ON m."partyId" = p.id
        GROUP BY p.id, p.name, p."shortName"
        ORDER BY count DESC
        LIMIT 10
      `,
      db.pressArticle.findMany({
        orderBy: { publishedAt: "desc" },
        take: 5,
        select: {
          title: true,
          feedSource: true,
          publishedAt: true,
          _count: { select: { mentions: true, partyMentions: true } },
        },
      }),
    ]);

    console.log("\n" + "=".repeat(60));
    console.log("Press Sync Stats");
    console.log("=".repeat(60));
    console.log(`\nTotal articles: ${totalArticles}`);
    console.log(`Total politician mentions: ${totalMentions}`);
    console.log(`Total party mentions: ${totalPartyMentions}`);

    console.log("\nArticles by source:");
    for (const { feedSource, _count } of articlesBySource) {
      const config = RSS_FEEDS.find((f) => f.id === feedSource);
      console.log(`  ${config?.name || feedSource}: ${_count}`);
    }

    console.log("\nTop 10 mentioned politicians:");
    for (const { fullName, count } of topMentioned) {
      console.log(`  ${fullName}: ${count}`);
    }

    console.log("\nTop 10 mentioned parties:");
    for (const { name, shortName, count } of topMentionedParties) {
      console.log(`  ${shortName} (${name}): ${count}`);
    }

    console.log("\nRecent articles:");
    for (const article of recentArticles) {
      const date = article.publishedAt.toISOString().split("T")[0];
      console.log(`  [${date}] ${article.title.slice(0, 60)}...`);
      console.log(
        `    Source: ${article.feedSource}, Politicians: ${article._count.mentions}, Parties: ${article._count.partyMentions}`
      );
    }
  },

  async sync(options): Promise<SyncResult> {
    const {
      dryRun = false,
      limit,
      feed,
      reindexParties = false,
    } = options as {
      dryRun?: boolean;
      limit?: number;
      feed?: string;
      reindexParties?: boolean;
    };

    // Handle reindex-parties mode (CLI-only feature, not in the service)
    if (reindexParties) {
      const reindexStats = {
        articlesReindexed: 0,
        partyMentionsCreated: 0,
      };
      const errors: string[] = [];

      console.log("Building party name index...");
      const parties = await buildPartyIndex();
      console.log(`Indexed ${parties.length} parties`);

      console.log("\n=".repeat(50));
      console.log("Reindexing party mentions on existing articles");
      console.log("=".repeat(50) + "\n");

      const articles = await db.pressArticle.findMany({
        select: { id: true, title: true, description: true },
      });

      console.log(`Found ${articles.length} articles to reindex\n`);

      const progress = new ProgressTracker({
        total: articles.length,
        label: "Reindexing parties",
        showBar: true,
        showETA: true,
        logInterval: 20,
      });

      for (const article of articles) {
        try {
          const searchText = `${article.title} ${article.description || ""}`;
          const partyMentions = findPartyMentions(searchText, parties);

          if (partyMentions.length > 0) {
            if (dryRun) {
              console.log(`\n[DRY-RUN] ${article.title.slice(0, 50)}...`);
              console.log(`  Parties: ${partyMentions.map((m) => m.matchedName).join(", ")}`);
            } else {
              await db.pressArticlePartyMention.deleteMany({
                where: { articleId: article.id },
              });
              await db.pressArticlePartyMention.createMany({
                data: partyMentions.map((m) => ({
                  articleId: article.id,
                  partyId: m.partyId,
                  matchedName: m.matchedName,
                })),
                skipDuplicates: true,
              });
            }
            reindexStats.articlesReindexed++;
            reindexStats.partyMentionsCreated += partyMentions.length;
          }
        } catch (error) {
          errors.push(`Error reindexing article ${article.id}: ${error}`);
        }
        progress.tick();
      }

      progress.finish();

      return {
        success: errors.length === 0,
        duration: 0,
        stats: reindexStats,
        errors,
      };
    }

    // Normal sync via service
    const stats = await syncPressService({ dryRun, limit, feed });

    return {
      success: stats.errors.length === 0,
      duration: 0,
      stats: {
        feedsFetched: stats.feedsFetched,
        articlesTotal: stats.articlesTotal,
        articlesNew: stats.articlesNew,
        articlesSkipped: stats.articlesSkipped,
        mentionsCreated: stats.mentionsCreated,
        partyMentionsCreated: stats.partyMentionsCreated,
      },
      errors: stats.errors,
    };
  },
};

createCLI(handler);
