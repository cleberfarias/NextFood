"use client";

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let emulatorConnected = false;

/**
 * Client-side Firebase Auth only -- the first legitimate use of the Firebase
 * Client SDK in this codebase (interactive sign-in has to happen in the
 * browser; the Admin SDK can't do it). Scoped to /login; never import this
 * from a Server Component or back/.
 */
export function getClientAuth(): Auth {
  if (auth) return auth;

  app = getApps()[0] ?? initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "demo-api-key",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "demo-nextfood",
  });

  auth = getAuth(app);

  const emulatorHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
  if (emulatorHost && !emulatorConnected) {
    connectAuthEmulator(auth, `http://${emulatorHost}`);
    emulatorConnected = true;
  }

  return auth;
}
