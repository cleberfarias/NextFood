import { z } from "zod";

export const establishSessionInputSchema = z.object({
  idToken: z.string().min(1, "Token de autenticação ausente."),
});

export type EstablishSessionInput = z.infer<typeof establishSessionInputSchema>;
