import { getAdminAuth } from "@/back/lib/firebase-admin";
import { SESSION_DURATION_MS, type AuthenticatedUser, type Session, type SessionRepository } from "@/back/domain/auth/session";

export class FirebaseSessionRepository implements SessionRepository {
  async createSession(idToken: string): Promise<Session> {
    await getAdminAuth().verifyIdToken(idToken);
    const cookie = await getAdminAuth().createSessionCookie(idToken, { expiresIn: SESSION_DURATION_MS });
    return { cookie, expiresInMs: SESSION_DURATION_MS };
  }

  async verifySession(cookie: string): Promise<AuthenticatedUser | null> {
    try {
      const decoded = await getAdminAuth().verifySessionCookie(cookie, true);
      return { uid: decoded.uid, email: decoded.email ?? null };
    } catch {
      return null;
    }
  }

  async revokeSession(cookie: string): Promise<void> {
    try {
      const decoded = await getAdminAuth().verifySessionCookie(cookie);
      await getAdminAuth().revokeRefreshTokens(decoded.uid);
    } catch {
      // Already invalid/expired -- nothing to revoke.
    }
  }
}
