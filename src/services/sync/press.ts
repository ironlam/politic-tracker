/**
 * Press RSS sync service.
 *
 * Fetches articles from RSS feeds and matches mentioned politicians and parties.
 */

import { db } from "@/lib/db";
import { RSSClient } from "@/lib/api";
import { RSS_RATE_LIMIT_MS } from "@/config/rate-limits";
import {
  buildPoliticianIndex,
  buildPartyIndex,
  findMentions,
  findPartyMentions,
} from "@/lib/name-matching";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PressSyncOptions {
  dryRun?: boolean;
  limit?: number;
  feed?: string;
}

export interface PressSyncStats {
  feedsFetched: number;
  articlesTotal: number;
  articlesNew: number;
  articlesSkipped: number;
  mentionsCreated: number;
  partyMentionsCreated: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Main service
// ---------------------------------------------------------------------------

export async function syncPress(options: PressSyncOptions = {}): Promise<PressSyncStats> {
  const { dryRun = false, limit, feed } = options;

  const stats: PressSyncStats = {
    feedsFetched: 0,
    articlesTotal: 0,
    articlesNew: 0,
    articlesSkipped: 0,
    mentionsCreated: 0,
    partyMentionsCreated: 0,
    errors: [],
  };

  // Build indices
  const parties = await buildPartyIndex();
  const politicians = await buildPoliticianIndex();

  // Fetch RSS feeds
  const rssClient = new RSSClient({ rateLimitMs: RSS_RATE_LIMIT_MS });
  const feedIds = feed ? [feed] : undefined;
  const feeds = await rssClient.fetchAllFeeds(feedIds);

  for (const [sourceId, feedData] of feeds) {
    stats.feedsFetched++;

    const items = limit ? feedData.items.slice(0, limit) : feedData.items;

    for (const item of items) {
      stats.articlesTotal++;

      try {
        // Check if article already exists
        const existing = await db.pressArticle.findUnique({
          where: {
            feedSource_externalId: {
              feedSource: sourceId,
              externalId: item.guid,
            },
          },
        });

        if (existing) {
          stats.articlesSkipped++;
          continue;
        }

        // Find politician and party mentions
        const searchText = `${item.title} ${item.description || ""}`;
        const mentions = findMentions(searchText, politicians);
        const partyMentions = findPartyMentions(searchText, parties);

        if (dryRun) {
          stats.articlesNew++;
          stats.mentionsCreated += mentions.length;
          stats.partyMentionsCreated += partyMentions.length;
        } else {
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
        stats.errors.push(`Error processing article "${item.title}": ${error}`);
      }
    }
  }

  return stats;
}
