import { z } from "zod/v4";

export const subscribeSchema = z.object({
  email: z.email("Adresse email invalide"),
});
