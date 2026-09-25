import type { AuthenticatedUser } from "@/back/domain/auth/session";

/**
 * Local-development escape hatch for reaching signed-in screens without the
 * Firebase Auth emulator running. Opt-in via DEV_SKIP_AUTH=true in
 * .env.local, and hard-disabled in production builds regardless of the flag,
 * so it can never become a real auth bypass.
 */
export function getDevPreviewUser(): AuthenticatedUser | null {
  if (process.env.NODE_ENV === "production") return null;
  if (process.env.DEV_SKIP_AUTH !== "true") return null;
  return { uid: "dev-preview", email: "Modo desenvolvimento (sem login)" };
}
