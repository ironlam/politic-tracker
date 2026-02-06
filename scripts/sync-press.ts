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
import {
  createCLI,
  ProgressTracker,
  type SyncHandler,
  type SyncResult,
} from "../src/lib/sync";
import { RSSClient, RSS_FEEDS, type RSSItem } from "../src/lib/api";
import { db } from "../src/lib/db";

// ============================================
// NAME MATCHING
// ============================================

interface PoliticianName {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  normalizedFullName: string;
  normalizedLastName: string;
}

interface PartyName {
  id: string;
  name: string;
  shortName: string;
  normalizedName: string;
  normalizedShortName: string;
}

/**
 * Normalize a string for matching (lowercase, remove accents)
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/['']/g, "'")
    .replace(/[-–—]/g, " ")
    .trim();
}

/**
 * Build a searchable index of politician names
 */
async function buildPoliticianIndex(): Promise<PoliticianName[]> {
  const politicians = await db.politician.findMany({
    select: {
      id: true,
      fullName: true,
      firstName: true,
      lastName: true,
    },
  });

  return politicians.map((p) => ({
    id: p.id,
    fullName: p.fullName,
    firstName: p.firstName,
    lastName: p.lastName,
    normalizedFullName: normalizeText(p.fullName),
    normalizedLastName: normalizeText(p.lastName),
  }));
}

/**
 * Build a searchable index of party names
 */
async function buildPartyIndex(): Promise<PartyName[]> {
  const parties = await db.party.findMany({
    select: {
      id: true,
      name: true,
      shortName: true,
    },
  });

  return parties.map((p) => ({
    id: p.id,
    name: p.name,
    shortName: p.shortName,
    normalizedName: normalizeText(p.name),
    normalizedShortName: normalizeText(p.shortName),
  }));
}

/**
 * Common French words to exclude from matching (avoid false positives)
 */
const EXCLUDED_NAMES = new Set([
  "paul", "jean", "pierre", "louis", "charles", "marie", "anne",
  "fait", "gauche", "droite", "maire", "parti", "france", "etat",
  "nord", "sud", "est", "ouest", "grand", "petit", "blanc", "noir",
  "rouge", "vert", "bleu", "rose", "brun", "long", "court", "haut", "bas",
]);

/**
 * Party short names to exclude (too common or ambiguous)
 */
const EXCLUDED_PARTY_SHORTNAMES = new Set([
  "lr", // Too common in text (e.g., "la République")
  "ps", // Post-scriptum
  "udi", // Too short
  "dvd", // Digital Versatile Disc
  "dvg", // Too short
]);

/**
 * Find politicians mentioned in text
 * Returns matches with the name that was found
 */
function findMentions(
  text: string,
  politicians: PoliticianName[]
): Array<{ politicianId: string; matchedName: string }> {
  const normalizedText = normalizeText(text);
  const matches: Array<{ politicianId: string; matchedName: string }> = [];
  const seenIds = new Set<string>();

  // Sort politicians by full name length (longer names first for more specific matches)
  const sortedPoliticians = [...politicians].sort(
    (a, b) => b.normalizedFullName.length - a.normalizedFullName.length
  );

  for (const politician of sortedPoliticians) {
    if (seenIds.has(politician.id)) continue;

    // Try full name first (more specific)
    const fullNameRegex = new RegExp(
      `\\b${escapeRegex(politician.normalizedFullName)}\\b`
    );
    if (fullNameRegex.test(normalizedText)) {
      matches.push({
        politicianId: politician.id,
        matchedName: politician.fullName,
      });
      seenIds.add(politician.id);
      continue;
    }

    // Try last name only (less specific, but catches more mentions)
    // Only match if last name is at least 5 characters (avoid false positives)
    // AND last name is not a common word
    if (
      politician.normalizedLastName.length >= 5 &&
      !EXCLUDED_NAMES.has(politician.normalizedLastName)
    ) {
      const lastNameRegex = new RegExp(
        `\\b${escapeRegex(politician.normalizedLastName)}\\b`
      );
      if (lastNameRegex.test(normalizedText)) {
        matches.push({
          politicianId: politician.id,
          matchedName: politician.lastName,
        });
        seenIds.add(politician.id);
      }
    }
  }

  return matches;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Find parties mentioned in text
 * Returns matches with the name that was found
 */
function findPartyMentions(
  text: string,
  parties: PartyName[]
): Array<{ partyId: string; matchedName: string }> {
  const normalizedText = normalizeText(text);
  const matches: Array<{ partyId: string; matchedName: string }> = [];
  const seenIds = new Set<string>();

  // Sort parties by full name length (longer names first for more specific matches)
  const sortedParties = [...parties].sort(
    (a, b) => b.normalizedName.length - a.normalizedName.length
  );

  for (const party of sortedParties) {
    if (seenIds.has(party.id)) continue;

    // Try full name first (more specific)
    const fullNameRegex = new RegExp(
      `\\b${escapeRegex(party.normalizedName)}\\b`
    );
    if (fullNameRegex.test(normalizedText)) {
      matches.push({
        partyId: party.id,
        matchedName: party.name,
      });
      seenIds.add(party.id);
      continue;
    }

    // Try short name (only if >= 3 characters to avoid false positives)
    // AND not in excluded list
    if (
      party.normalizedShortName.length >= 3 &&
      !EXCLUDED_PARTY_SHORTNAMES.has(party.normalizedShortName)
    ) {
      const shortNameRegex = new RegExp(
        `\\b${escapeRegex(party.normalizedShortName)}\\b`
      );
      if (shortNameRegex.test(normalizedText)) {
        matches.push({
          partyId: party.id,
          matchedName: party.shortName,
        });
        seenIds.add(party.id);
      }
    }
  }

  return matches;
}

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
      console.log(`    Source: ${article.feedSource}, Politicians: ${article._count.mentions}, Parties: ${article._count.partyMentions}`);
    }
  },

  async sync(options): Promise<SyncResult> {
    const { dryRun = false, limit, feed, reindexParties = false } = options as {
      dryRun?: boolean;
      limit?: number;
      feed?: string;
      reindexParties?: boolean;
    };

    const stats = {
      feedsFetched: 0,
      articlesTotal: 0,
      articlesNew: 0,
      articlesSkipped: 0,
      articlesReindexed: 0,
      mentionsCreated: 0,
      partyMentionsCreated: 0,
    };
    const errors: string[] = [];

    // Build party index (always needed)
    console.log("Building party name index...");
    const parties = await buildPartyIndex();
    console.log(`Indexed ${parties.length} parties`);

    // Handle reindex-parties mode
    if (reindexParties) {
      console.log("\n=".repeat(50));
      console.log("Reindexing party mentions on existing articles");
      console.log("=".repeat(50) + "\n");

      // Get all articles
      const articles = await db.pressArticle.findMany({
        select: {
          id: true,
          title: true,
          description: true,
        },
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
              // Delete existing party mentions for this article
              await db.pressArticlePartyMention.deleteMany({
                where: { articleId: article.id },
              });

              // Create new party mentions
              await db.pressArticlePartyMention.createMany({
                data: partyMentions.map((m) => ({
                  articleId: article.id,
                  partyId: m.partyId,
                  matchedName: m.matchedName,
                })),
                skipDuplicates: true,
              });
            }
            stats.articlesReindexed++;
            stats.partyMentionsCreated += partyMentions.length;
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
        stats,
        errors,
      };
    }

    // Build politician index
    console.log("Building politician name index...");
    const politicians = await buildPoliticianIndex();
    console.log(`Indexed ${politicians.length} politicians\n`);

    // Fetch RSS feeds
    const rssClient = new RSSClient({ rateLimitMs: 1000 });
    const feedIds = feed ? [feed] : undefined;

    console.log("Fetching RSS feeds...\n");
    const feeds = await rssClient.fetchAllFeeds(feedIds);

    for (const [sourceId, feedData] of feeds) {
      const config = RSS_FEEDS.find((f) => f.id === sourceId);
      console.log(`\n${"=".repeat(50)}`);
      console.log(`Processing: ${config?.name || sourceId}`);
      console.log(`${"=".repeat(50)}`);

      stats.feedsFetched++;

      const items = limit ? feedData.items.slice(0, limit) : feedData.items;
      console.log(`Found ${items.length} articles\n`);

      const progress = new ProgressTracker({
        total: items.length,
        label: `Processing ${sourceId}`,
        showBar: true,
        showETA: true,
        logInterval: 10,
      });

      for (const item of items) {
        stats.articlesTotal++;

        try {
          // Check if article already exists
          const existing = await db.pressArticle.findUnique({
            where: { url: item.link },
          });

          if (existing) {
            stats.articlesSkipped++;
            progress.tick();
            continue;
          }

          // Find politician and party mentions
          const searchText = `${item.title} ${item.description || ""}`;
          const mentions = findMentions(searchText, politicians);
          const partyMentions = findPartyMentions(searchText, parties);

          if (dryRun) {
            console.log(`\n[DRY-RUN] ${item.title.slice(0, 60)}...`);
            console.log(`  URL: ${item.link}`);
            console.log(`  Published: ${item.pubDate.toISOString()}`);
            console.log(`  Politicians: ${mentions.length}`);
            if (mentions.length > 0) {
              const names = mentions.map((m) => m.matchedName).join(", ");
              console.log(`    -> ${names}`);
            }
            console.log(`  Parties: ${partyMentions.length}`);
            if (partyMentions.length > 0) {
              const names = partyMentions.map((m) => m.matchedName).join(", ");
              console.log(`    -> ${names}`);
            }
            stats.articlesNew++;
            stats.mentionsCreated += mentions.length;
            stats.partyMentionsCreated += partyMentions.length;
          } else {
            // Create article with mentions
            await db.pressArticle.create({
              data: {
                feedSource: sourceId,
                externalId: item.guid,
                title: item.title,
                description: item.description,
                url: item.link,
                imageUrl: item.imageUrl,
                publishedAt: item.pubDate,
                mentions: {
                  create: mentions.map((m) => ({
                    politicianId: m.politicianId,
                    matchedName: m.matchedName,
                  })),
                },
                partyMentions: {
                  create: partyMentions.map((m) => ({
                    partyId: m.partyId,
                    matchedName: m.matchedName,
                  })),
                },
              },
            });

            stats.articlesNew++;
            stats.mentionsCreated += mentions.length;
            stats.partyMentionsCreated += partyMentions.length;
          }
        } catch (error) {
          const errorMsg = `Error processing article "${item.title}": ${error}`;
          errors.push(errorMsg);
          console.error(`\n${errorMsg}`);
        }

        progress.tick();
      }

      progress.finish();
    }

    return {
      success: errors.length === 0,
      duration: 0,
      stats,
      errors,
    };
  },
};

createCLI(handler);
