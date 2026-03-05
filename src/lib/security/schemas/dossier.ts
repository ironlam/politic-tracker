import { z } from "zod/v4";

export const updateDossierSchema = z.object({
  summary: z.string().optional(),
  shortTitle: z.string().optional(),
  category: z.string().optional(),
  status: z.string().optional(),
  theme: z.string().optional(),
});
