import { z } from "zod";

/**
 * The Server Action's input contract -- shaped for the form, not the
 * domain. Kept separate from back/domain/waitlist's own types on purpose.
 */
export const waitlistSignupInputSchema = z.object({
  email: z.string().trim().min(1, "Informe seu e-mail").email("E-mail inválido"),
  businessName: z.string().trim().min(2, "Informe o nome do seu negócio"),
});

export type WaitlistSignupInput = z.infer<typeof waitlistSignupInputSchema>;
