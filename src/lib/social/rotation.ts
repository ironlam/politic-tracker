import { db } from "@/lib/db";
import { SOCIAL_CATEGORIES, type SocialCategory } from "./config";

const ROTATION_KEY = "social:rotation-index";

/** Read the current rotation index (0-8). Returns 0 if not yet initialized. */
export async function getRotationIndex(): Promise<number> {
  const row = await db.statsSnapshot.findUnique({ where: { key: ROTATION_KEY } });
  if (!row) return 0;
  const idx = (row.data as { index: number }).index;
  return typeof idx === "number" ? idx % SOCIAL_CATEGORIES.length : 0;
}

/** Get the next category to post. */
export async function getNextCategory(): Promise<SocialCategory> {
  const idx = await getRotationIndex();
  return SOCIAL_CATEGORIES[idx]!;
}

/** Advance the rotation index by 1 (modulo 9). */
export async function advanceRotation(): Promise<void> {
  const current = await getRotationIndex();
  const next = (current + 1) % SOCIAL_CATEGORIES.length;
  await db.statsSnapshot.upsert({
    where: { key: ROTATION_KEY },
    create: { key: ROTATION_KEY, data: { index: next }, durationMs: 0 },
    update: { data: { index: next }, computedAt: new Date() },
  });
}
