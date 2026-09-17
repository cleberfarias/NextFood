"use server";

import { AlreadyOnWaitlistError, joinWaitlist } from "@/back/domain/waitlist/waitlist";
import { FirestoreWaitlistRepository } from "@/back/data/waitlist/firestore-waitlist-repository";
import { waitlistSignupInputSchema } from "@/back/schemas/waitlist";

export type WaitlistActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<"email" | "businessName", string>>;
};

export const initialWaitlistActionState: WaitlistActionState = { status: "idle" };

export async function joinWaitlistAction(
  _prevState: WaitlistActionState,
  formData: FormData,
): Promise<WaitlistActionState> {
  // 1. Validate input -- never trust the raw FormData shape.
  const parsed = waitlistSignupInputSchema.safeParse({
    email: formData.get("email"),
    businessName: formData.get("businessName"),
  });

  if (!parsed.success) {
    const fieldErrors: WaitlistActionState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "email" || field === "businessName") {
        fieldErrors[field] = issue.message;
      }
    }
    return { status: "error", fieldErrors, message: "Corrija os campos destacados." };
  }

  // 2. Authorization -- this action is intentionally public (pre-launch
  // waitlist signup): there is no session or tenant/store to check. When a
  // future action needs authorization, this is the step that resolves the
  // session server-side and verifies tenant/store membership -- never from a
  // client-sent id/role.

  // 3. Execute the use case.
  try {
    await joinWaitlist(new FirestoreWaitlistRepository(), parsed.data);
  } catch (error) {
    if (error instanceof AlreadyOnWaitlistError) {
      return { status: "error", message: "Esse e-mail já está na nossa lista de espera." };
    }

    // Includes Firestore/Admin SDK failures (e.g. not provisioned/configured
    // yet) -- never let a data-layer error crash the page.
    console.error("joinWaitlistAction failed", error);
    return {
      status: "error",
      message: "Não foi possível registrar seu interesse agora. Tente novamente em breve.",
    };
  }

  // 4. Nothing else on this page reads waitlist data yet, so there is
  // nothing to revalidate.
  // 5. Plain, serializable result for useActionState.
  return { status: "success", message: "Você entrou na nossa lista de espera!" };
}
