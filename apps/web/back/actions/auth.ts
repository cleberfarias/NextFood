import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { endSession, establishSession, getAuthenticatedUser, type AuthenticatedUser } from "@/back/domain/auth/session";
import { FirebaseSessionRepository } from "@/back/data/auth/firebase-session-repository";
import { establishSessionInputSchema } from "@/back/schemas/auth";

const SESSION_COOKIE_NAME = "nextfood_session";

export type EstablishSessionResult =
  | { status: "success" }
  | { status: "error"; message: string };

/**
 * Server Action: exchanges a client-obtained Firebase ID token for an
 * httpOnly session cookie. Called imperatively from login-form.tsx right
 * after a successful client-side signInWithEmailAndPassword -- this action
 * *is* the authentication step, so there is no separate authorization check
 * here (nothing to authorize against yet).
 *
 * Deliberately does NOT call redirect() here: this is invoked imperatively
 * (not via <form action>) from a client component that awaits it inside its
 * own try/catch. redirect() works by throwing a special error, which that
 * catch would otherwise swallow. Navigation after success is the caller's
 * job (router.push), same as any other action result.
 */
export async function establishSessionAction(idToken: string): Promise<EstablishSessionResult> {
  "use server";

  const parsed = establishSessionInputSchema.safeParse({ idToken });
  if (!parsed.success) {
    return { status: "error", message: "Não foi possível concluir o login." };
  }

  try {
    const session = await establishSession(new FirebaseSessionRepository(), parsed.data.idToken);
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, session.cookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(session.expiresInMs / 1000),
    });
  } catch (error) {
    console.error("establishSessionAction failed", error);
    return { status: "error", message: "Não foi possível concluir o login. Tente novamente." };
  }

  return { status: "success" };
}

/**
 * Server Action: reads the *current* session cookie server-side (never a
 * client-supplied uid) to know who is signing out, revokes it, then clears
 * the cookie.
 */
export async function signOutAction(): Promise<void> {
  "use server";

  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  await endSession(new FirebaseSessionRepository(), cookie);
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}

/**
 * Server-only query for Server Components (app/login, app/dashboard) --
 * not a Server Action, just memoized per-request via React's cache().
 */
export const getCurrentUser = cache(async (): Promise<AuthenticatedUser | null> => {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return getAuthenticatedUser(new FirebaseSessionRepository(), cookie);
});
