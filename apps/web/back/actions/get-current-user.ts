import { cache } from "react";
import { cookies } from "next/headers";
import { getAuthenticatedUser, type AuthenticatedUser } from "@/back/domain/auth/session";
import { FirebaseSessionRepository } from "@/back/data/auth/firebase-session-repository";

export const SESSION_COOKIE_NAME = "nextfood_session";

/**
 * Server-only query for Server Components (app/login, app/dashboard) --
 * deliberately NOT in auth.ts: a file with a top-level "use server" (like
 * auth.ts) may only export async functions treated as callable actions: a
 * plain cached query doesn't belong there, and this file is never imported
 * from a Client Component, so it needs no directive of its own.
 */
export const getCurrentUser = cache(async (): Promise<AuthenticatedUser | null> => {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return getAuthenticatedUser(new FirebaseSessionRepository(), cookie);
});
