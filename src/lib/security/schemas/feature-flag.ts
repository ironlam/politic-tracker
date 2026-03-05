import { z } from "zod/v4";

export const createFeatureFlagSchema = z.object({
  name: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
});

export const updateFeatureFlagSchema = z.object({
  label: z.string().optional(),
  description: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
  value: z.unknown().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
});
