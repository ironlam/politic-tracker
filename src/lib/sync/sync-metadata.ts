/**
 * SyncMetadata service
 *
 * Tracks sync state (ETag, cursor, content hash, last sync time) to enable
 * incremental syncs. Each source gets a unique sourceKey.
 *
 * Usage:
 * ```typescript
 * const meta = await syncMetadata.get("votes-an-zip");
 * if (!force && !syncMetadata.shouldSync("votes-an-zip", ONE_HOUR)) {
 *   console.log("Skipping, synced recently");
 *   return;
 * }
 * // ... do sync ...
 * await syncMetadata.markCompleted("votes-an-zip", { etag, contentHash, itemCount });
 * ```
 */

import { db } from "../db";
import type { Prisma } from "@/generated/prisma";

export interface SyncState {
  sourceKey: string;
  lastSyncAt: Date | null;
  etag: string | null;
  lastModified: string | null;
  cursor: string | null;
  contentHash: string | null;
  itemCount: number | null;
  lastDurationS: number | null;
  extra: Record<string, unknown> | null;
}

export interface MarkCompletedOptions {
  itemCount?: number;
  durationS?: number;
  etag?: string | null;
  lastModified?: string | null;
  cursor?: string | null;
  contentHash?: string | null;
  extra?: Record<string, unknown>;
}

export const syncMetadata = {
  /**
   * Get sync state for a source key
   */
  async get(sourceKey: string): Promise<SyncState | null> {
    const row = await db.syncMetadata.findUnique({ where: { sourceKey } });
    if (!row) return null;
    return {
      sourceKey: row.sourceKey,
      lastSyncAt: row.lastSyncAt,
      etag: row.etag,
      lastModified: row.lastModified,
      cursor: row.cursor,
      contentHash: row.contentHash,
      itemCount: row.itemCount,
      lastDurationS: row.lastDurationS,
      extra: row.extra as Record<string, unknown> | null,
    };
  },

  /**
   * Set (upsert) sync state
   */
  async set(sourceKey: string, data: Partial<MarkCompletedOptions>): Promise<void> {
    await db.syncMetadata.upsert({
      where: { sourceKey },
      create: {
        sourceKey,
        lastSyncAt: new Date(),
        etag: data.etag ?? null,
        lastModified: data.lastModified ?? null,
        cursor: data.cursor ?? null,
        contentHash: data.contentHash ?? null,
        itemCount: data.itemCount ?? null,
        lastDurationS: data.durationS ?? null,
        extra: (data.extra as Prisma.InputJsonValue) ?? undefined,
      },
      update: {
        lastSyncAt: new Date(),
        ...(data.etag !== undefined && { etag: data.etag }),
        ...(data.lastModified !== undefined && { lastModified: data.lastModified }),
        ...(data.cursor !== undefined && { cursor: data.cursor }),
        ...(data.contentHash !== undefined && { contentHash: data.contentHash }),
        ...(data.itemCount !== undefined && { itemCount: data.itemCount }),
        ...(data.durationS !== undefined && { lastDurationS: data.durationS }),
        ...(data.extra !== undefined && { extra: data.extra as Prisma.InputJsonValue }),
      },
    });
  },

  /**
   * Mark a sync as completed with timing and stats
   */
  async markCompleted(sourceKey: string, options: MarkCompletedOptions = {}): Promise<void> {
    await this.set(sourceKey, options);
  },

  /**
   * Check if a sync should run based on minimum interval
   */
  async shouldSync(sourceKey: string, minIntervalMs: number): Promise<boolean> {
    const state = await this.get(sourceKey);
    if (!state?.lastSyncAt) return true;
    return Date.now() - state.lastSyncAt.getTime() >= minIntervalMs;
  },

  /**
   * Get all sync metadata (for --stats)
   */
  async getAll(): Promise<SyncState[]> {
    const rows = await db.syncMetadata.findMany({
      orderBy: { lastSyncAt: "desc" },
    });
    return rows.map((row) => ({
      sourceKey: row.sourceKey,
      lastSyncAt: row.lastSyncAt,
      etag: row.etag,
      lastModified: row.lastModified,
      cursor: row.cursor,
      contentHash: row.contentHash,
      itemCount: row.itemCount,
      lastDurationS: row.lastDurationS,
      extra: row.extra as Record<string, unknown> | null,
    }));
  },

  /**
   * Reset sync state for a source key (force re-sync)
   */
  async reset(sourceKey: string): Promise<void> {
    await db.syncMetadata.deleteMany({ where: { sourceKey } });
  },
};
