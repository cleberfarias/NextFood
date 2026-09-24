// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  endSession,
  establishSession,
  getAuthenticatedUser,
  type AuthenticatedUser,
  type Session,
  type SessionRepository,
} from "./session";

/**
 * In-memory fake -- proves the session use cases are testable with no
 * Next.js, no Firebase, no emulator. Just the port they declare.
 */
class InMemorySessionRepository implements SessionRepository {
  private sessions = new Map<string, AuthenticatedUser>();
  private revoked = new Set<string>();

  async createSession(idToken: string): Promise<Session> {
    const cookie = `session-for-${idToken}`;
    this.sessions.set(cookie, { uid: `uid-${idToken}`, email: `${idToken}@example.com` });
    return { cookie, expiresInMs: 1000 };
  }

  async verifySession(cookie: string): Promise<AuthenticatedUser | null> {
    if (this.revoked.has(cookie)) return null;
    return this.sessions.get(cookie) ?? null;
  }

  async revokeSession(cookie: string): Promise<void> {
    this.revoked.add(cookie);
  }
}

describe("session use cases", () => {
  it("establishes a session from an id token", async () => {
    const repo = new InMemorySessionRepository();
    const session = await establishSession(repo, "valid-token");
    expect(session.cookie).toBe("session-for-valid-token");
  });

  it("returns null for a missing cookie", async () => {
    const repo = new InMemorySessionRepository();
    expect(await getAuthenticatedUser(repo, undefined)).toBeNull();
  });

  it("returns the authenticated user for a valid cookie", async () => {
    const repo = new InMemorySessionRepository();
    const session = await establishSession(repo, "valid-token");
    const user = await getAuthenticatedUser(repo, session.cookie);
    expect(user?.uid).toBe("uid-valid-token");
  });

  it("no longer authenticates after the session is ended", async () => {
    const repo = new InMemorySessionRepository();
    const session = await establishSession(repo, "valid-token");
    await endSession(repo, session.cookie);
    expect(await getAuthenticatedUser(repo, session.cookie)).toBeNull();
  });
});
