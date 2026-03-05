import { z } from "zod/v4";

export const createMandateSchema = z.object({
  politicianId: z.string().min(1),
  partyId: z.string().min(1),
  title: z.string().min(1).max(500),
  startDate: z.string().min(1),
  endDate: z.string().nullable().optional(),
  sourceUrl: z.string().optional(),
  officialUrl: z.string().optional(),
});

export const updateMandateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  startDate: z.string().optional(),
  endDate: z.string().nullable().optional(),
  sourceUrl: z.string().optional(),
  officialUrl: z.string().optional(),
});

export const patchMandateSchema = z.object({
  officialUrl: z.string().optional(),
  sourceUrl: z.string().optional(),
});
