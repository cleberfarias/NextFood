"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { endSession, establishSession } from "@/back/domain/auth/session";
import { FirebaseSessionRepository } from "@/back/data/auth/firebase-session-repository";
import { establishSessionInputSchema } from "@/back/schemas/auth";
import { SESSION_COOKIE_NAME } from "@/back/actions/get-current-user";

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
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  await endSession(new FirebaseSessionRepository(), cookie);
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}
