export type AuthenticatedUser = {
  uid: string;
  email: string | null;
};

export type Session = {
  cookie: string;
  expiresInMs: number;
};

/**
 * Port: back/data provides the concrete (Firebase Auth) implementation.
 * Domain code only ever depends on this interface, never on firebase-admin.
 */
export interface SessionRepository {
  createSession(idToken: string): Promise<Session>;
  verifySession(cookie: string): Promise<AuthenticatedUser | null>;
  revokeSession(cookie: string): Promise<void>;
}

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

export async function establishSession(
  repository: SessionRepository,
  idToken: string,
): Promise<Session> {
  return repository.createSession(idToken);
}

export async function getAuthenticatedUser(
  repository: SessionRepository,
  cookie: string | undefined,
): Promise<AuthenticatedUser | null> {
  if (!cookie) return null;
  return repository.verifySession(cookie);
}

export async function endSession(repository: SessionRepository, cookie: string | undefined): Promise<void> {
  if (!cookie) return;
  await repository.revokeSession(cookie);
}

export const SESSION_DURATION_MS = TWO_WEEKS_MS;
