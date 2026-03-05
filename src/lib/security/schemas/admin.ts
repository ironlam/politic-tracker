import { z } from "zod/v4";

const VALID_CACHE_TAGS = [
  "politicians",
  "parties",
  "votes",
  "stats",
  "dossiers",
  "factchecks",
  "elections",
] as const;

export const revalidateCacheSchema = z.union([
  z.object({ all: z.literal(true) }),
  z.object({ tags: z.array(z.enum(VALID_CACHE_TAGS)).min(1) }),
]);

export const createSyncSchema = z.object({
  script: z.string().min(1).max(200),
});

export const resolveIdentitySchema = z.object({
  judgement: z.enum(["SAME", "NOT_SAME"]),
  politicianId: z.string().optional(),
});

export const deleteRejectionsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

export const recoverRejectionSchema = z.object({
  rejectionId: z.string().min(1),
});

export const syncPoliticianSchema = z.object({
  type: z.enum(["factchecks", "press", "judilibre"]),
});
