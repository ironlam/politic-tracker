import { z } from "zod/v4";

export const updatePoliticianSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  civility: z.enum(["M.", "Mme"]).optional(),
  birthDate: z.string().nullable().optional(),
  deathDate: z.string().nullable().optional(),
  birthPlace: z.string().nullable().optional(),
  photoUrl: z.string().url().nullable().optional(),
  profession: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  publicationStatus: z.enum(["PUBLISHED", "DRAFT", "ARCHIVED", "EXCLUDED", "REJECTED"]).optional(),
  currentPartyId: z.string().nullable().optional(),
  externalIds: z
    .array(
      z.object({
        source: z.string().min(1),
        externalId: z.string().min(1),
      })
    )
    .optional(),
});

export const detectDuplicatesSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  birthDate: z.string().nullable().optional(),
});
