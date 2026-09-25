import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let app: App | undefined;

function usingEmulators(): boolean {
  return Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST);
}

/**
 * Lazily initializes a single Admin SDK app instance. Server-only: never
 * import this from back/domain or front/.
 *
 * Two modes:
 * - Emulator (FIREBASE_AUTH_EMULATOR_HOST / FIRESTORE_EMULATOR_HOST set, e.g.
 *   local dev): only needs a project id, no real credentials -- the SDK reads
 *   the emulator host env vars once, at construction time, which is why they
 *   must already be set before this function's first call.
 * - Production: FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY
 *   (see .env.local.example). Throws a clear error instead of crashing at
 *   module-load time if they aren't configured yet -- callers (back/data
 *   adapters) are expected to catch this and surface a domain-level error.
 */
function getFirebaseAdminApp(): App {
  if (app) return app;

  const existing = getApps()[0];
  if (existing) {
    app = existing;
    return app;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID ?? "demo-nextfood";

  if (usingEmulators()) {
    app = initializeApp({ projectId });
    return app;
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!process.env.FIREBASE_PROJECT_ID || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin SDK is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL " +
        "and FIREBASE_PRIVATE_KEY (see .env.local.example), or point FIREBASE_AUTH_EMULATOR_HOST " +
        "/ FIRESTORE_EMULATOR_HOST at the local emulators for development.",
    );
  }

  app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return app;
}

export function getAdminFirestore(): Firestore {
  return getFirestore(getFirebaseAdminApp());
}

export function getAdminAuth(): Auth {
  return getAuth(getFirebaseAdminApp());
}
