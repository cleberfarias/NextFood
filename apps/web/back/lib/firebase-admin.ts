import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let app: App | undefined;

/**
 * Lazily initializes a single Admin SDK app instance from environment
 * variables (see .env.local.example). Server-only: never import this from
 * back/domain or front/. Throws a clear error instead of crashing at
 * module-load time if credentials aren't configured yet -- callers (back/data
 * adapters) are expected to catch this and surface a domain-level error.
 */
function getFirebaseAdminApp(): App {
  if (app) return app;

  const existing = getApps()[0];
  if (existing) {
    app = existing;
    return app;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin SDK is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL " +
        "and FIREBASE_PRIVATE_KEY (see .env.local.example).",
    );
  }

  app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return app;
}

export function getAdminFirestore(): Firestore {
  return getFirestore(getFirebaseAdminApp());
}
