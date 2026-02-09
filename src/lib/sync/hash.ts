/**
 * Hash utilities for incremental sync
 *
 * Provides deterministic hashing for detecting changes in sync data.
 */

import { createHash } from "crypto";
import { createReadStream } from "fs";

/**
 * Hash a file's contents (MD5)
 */
export function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("md5");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

/**
 * Hash a string or buffer (MD5)
 */
export function hashContent(data: string | Buffer): string {
  return createHash("md5").update(data).digest("hex");
}

/**
 * Hash a set of votes deterministically
 *
 * Sorts votes by politicianId to ensure consistent ordering,
 * then hashes the serialized result.
 */
export function hashVotes(votes: Array<{ politicianId: string; position: string }>): string {
  const sorted = [...votes].sort((a, b) => a.politicianId.localeCompare(b.politicianId));
  const serialized = sorted.map((v) => `${v.politicianId}:${v.position}`).join("|");
  return hashContent(serialized);
}
