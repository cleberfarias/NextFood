# NextFood Authentication + 3D Chef login experience — design

Status: approved for implementation
Date: 2026-09-17
Related: [2026-09-17-web-front-back-architecture-design.md](2026-09-17-web-front-back-architecture-design.md), [2026-09-17-firestore-multitenant-rules-design.md](2026-09-17-firestore-multitenant-rules-design.md)

## Context

Before this change, NextFood had no Authentication of any kind: no `/login` route, no Firebase Auth wiring, no session handling. This spec builds the real Auth foundation (Firebase email/password sign-in, server-side session cookies, a protected stub `/dashboard`) **and**, on top of it in the same change, the 3D "Chef throws the login card" experience the product asked for. These were considered as two separable sub-projects (Auth foundation, then the 3D layer) and deliberately combined into one delivery at the requester's explicit choice, accepting the added review/debugging surface that comes with that.

`chef.glb` (the 3D asset) is not in the repository yet at spec-writing time. All code is written against `/public/models/chef.glb` and fails gracefully in its absence (see Fallbacks) — the happy-path throw animation can only be manually verified once the real file is added.

## Auth foundation

### Session strategy

Firebase session cookies (the officially documented approach for SSR apps that need server-side knowledge of auth state), not raw ID tokens:

1. Client-side: `front/features/auth/login-form.tsx` calls `signInWithEmailAndPassword` (Firebase **Client** SDK — the first legitimate use of it in this codebase, exactly the kind of concrete need the front/back architecture spec anticipated) to get an ID token.
2. The ID token is passed to `back/actions/auth.ts`'s `establishSessionAction`, a Server Action, which verifies it and exchanges it for an httpOnly session cookie (`~2 weeks` expiry) via the Admin SDK.
3. `/dashboard` (a stub page — see below) and `/login`'s own redirect-if-authenticated check both read and verify that cookie server-side. No middleware yet: there is exactly one protected route, so a per-page check is proportionate; middleware-based protection is a natural follow-up once more protected routes exist.

### Domain layer

`back/domain/auth/session.ts`: a `SessionRepository` port (`createSession(idToken): Promise<Session>`, `verifySession(cookie): Promise<AuthenticatedUser | null>`, `revokeSession(cookie): Promise<void>`) and a `AuthenticatedUser { uid, email }` type. Zero imports of `firebase-admin`/`next`/`react` — covered automatically by the existing `back/architecture.test.ts`, which walks all of `back/domain/**`. The use cases here are intentionally thin (there is little "business rule" in establishing a bare session); the port/adapter split is kept anyway because it's the project's stated architectural rule, not conditional on how much logic happens to exist yet.

`back/data/auth/firebase-session-repository.ts` implements the port via `firebase-admin/auth`'s `createSessionCookie`/`verifySessionCookie`/`revokeRefreshTokens`.

### Server Actions

`back/actions/auth.ts`, following the established 5-step contract:

- `establishSessionAction(idToken: string)`: validate (`back/schemas/auth.ts`: non-empty string) -> authorization N/A (this action *is* the authentication step) -> verify the token and create the session cookie (`cookies().set(...)`, httpOnly, secure in production, sameSite lax) -> `redirect('/dashboard')`.
- `signOutAction()`: reads the *current* session cookie server-side (never a client-supplied uid) -> revokes it via the Admin SDK -> clears the cookie -> `redirect('/login')`.

Sign-up/registration is explicitly out of scope — accounts are seeded via the Auth Emulator for local development (see below); a real sign-up flow is a separate future feature.

### Local development: Firebase Auth Emulator

Per explicit decision: local dev/testing uses the **Firebase Auth Emulator**, never the real `nextfood-76bc3` project (which has no Auth provider configured yet anyway, confirmed in the 2026-09-17 audit). `firebase.json` gets an `auth` emulator entry (port 9099, the default). `back/lib/firebase-admin.ts` sets `process.env.FIREBASE_AUTH_EMULATOR_HOST` *before* the Admin `Auth` instance is constructed (the SDK reads it once, at construction time). The client SDK calls `connectAuthEmulator` when `NEXT_PUBLIC_USE_FIREBASE_AUTH_EMULATOR=true`. `.env.local.example` documents how to create a local test user (`firebase emulators:start --only auth`, then the emulator UI or the REST `signUp` endpoint).

## 3D Chef experience

### Animation mapping

The GLB ships 4 clips; `01a0b102-2b5d-7770-b034-48daf886b806` is the custom throw clip. The GLB is never edited to rename it — a code-level mapping is the seam:

```ts
// front/features/auth/chef-animations.ts
export const ANIMATIONS = {
  idle: 'restpose',
  walk: 'Walking',
  run: 'Running',
  throwLogin: '01a0b102-2b5d-7770-b034-48daf886b806',
} as const;
```

Only these four are used. No `celebrate`/`confused`/`cover_eyes` or any other clip is invented in this pass.

### Central timeline controller (no scattered `setTimeout`)

A single hook, `useLoginSequence()` (`front/features/auth/use-login-sequence.ts`), is the one source of truth for the sequence, exposed via a small React Context so both `ChefCharacter` and `LoginCard` read the same state instead of coordinating through independent timers:

```
stage: 'booting' | 'chef-entering' | 'throwing' | 'card-visible' | 'idle'
```

Transitions:
- `booting -> chef-entering`: once the GLTF has loaded and the Canvas has mounted.
- `chef-entering -> throwing`: after the entrance settles, the controller plays the `throwLogin` action.
- `throwing -> card-visible`: **not** a `setTimeout` guess. Inside the R3F `useFrame` loop, the controller compares the currently-playing `throwLogin` action's `.time` against the configurable `THROW_RELEASE_TIME` constant (seconds into the clip) and fires the release exactly once when `action.time >= THROW_RELEASE_TIME`. This ties the release to the actual animation clock, which is what "sync the throw with the card" means in practice.
- `card-visible -> idle`: on the mixer's `finished` event for the `throwLogin` action, the controller crossfades to `restpose` (`idle`).

`THROW_RELEASE_TIME` lives as one named, commented constant at the top of `chef-animations.ts` for easy calibration once the real GLB is in hand.

### Component boundaries

- `ChefCharacter.tsx` (`front/features/auth/chef-character.tsx`): loads `/models/chef.glb` via `useGLTF` + `useAnimations`, reads the shared sequence context, drives clip playback and the `useFrame` release check. Contains no HTML/DOM — pure R3F/three.
- `LoginExperienceCanvas` (`front/features/auth/login-experience-canvas.tsx`): the `<Canvas>` wrapper (lights, environment, camera), lazy-loaded via `next/dynamic(..., { ssr: false })` from a `'use client'` boundary — Three.js/WebGL code never reaches the server bundle and never runs outside `/login`.
- `LoginCard` (`front/features/auth/login-card.tsx`): **plain HTML/React**, not part of the Three.js scene graph, absolutely positioned over the canvas. Reads the shared sequence context only to know when to animate in; renders the real, functional email/password form (`login-form.tsx`) inside it.
- `LoginExperience` (`front/features/auth/login-experience.tsx`): the orchestrator — provides the sequence context, renders the canvas and the card as siblings (card is real DOM, canvas is a `<canvas>` element; nothing about the card is inside the Three.js tree).

### LoginCard choreography

Using `motion` (Motion for React), driven by `stage === 'card-visible'`:

| | from | to |
|---|---|---|
| opacity | 0 | 1 |
| scale | 0.25 | 1 |
| rotateY | -25deg | 0 |
| rotateZ | 10deg | 0 |
| position | near the chef's hand (a fixed offset tuned against the model) | final resting position |

A spring transition (`type: 'spring'`, tuned stiffness/damping) gives the "thrown" feel rather than a linear/eased tween.

### Fallbacks

- **WebGL unavailable**: detected before mounting the Canvas (attempt to get a `webgl`/`webgl2` context on a throwaway `<canvas>`; if null, skip straight to rendering `LoginCard` in its resting state, no 3D).
- **GLB fails to load**: `useGLTF`'s suspense-based load is wrapped in a React `ErrorBoundary` around `LoginExperienceCanvas`; on error, same fallback as above.
- In both cases the login form is fully functional immediately — the 3D layer is decoration, never a gate on the product working.
- `prefers-reduced-motion: reduce`: skips the chef choreography and the button-dodge micro-interaction entirely; `LoginCard` appears in its resting state without the spring entrance. Login still works identically.

### Button micro-interaction ("escaping" submit button)

Contained in `login-form.tsx` (logic extracted into a small pure function, `computeDodge(cursor, buttonRect, dodgeCount)`, for unit testing without a real browser). Rules:
- Tracked only via `pointermove`/`mousemove` proximity to the submit button — **never** via focus/keydown, so keyboard navigation (Tab, Enter) never triggers it.
- Only engages while email or password is empty.
- At most 2 dodges; the third approach (or any approach once both fields are non-empty) leaves the button in place.
- After the dodge budget is spent (or fields are filled in and the user submits with something still missing — defensive, shouldn't normally happen), submitting with empty fields shows the conventional message: "Preencha seu e-mail e senha para continuar."
- Disabled entirely under `prefers-reduced-motion`.

## Route structure

```
apps/web/app/login/page.tsx        # Server Component: redirect to /dashboard if already authenticated, else render LoginExperience
apps/web/app/dashboard/page.tsx    # Server Component: redirect to /login if not authenticated; stub content + sign-out button
```

`/dashboard` is a minimal placeholder ("Você está autenticado", sign-out button) — not the real product dashboard, which remains explicitly out of scope.

## Testing

- `back/domain/auth/session.test.ts`: use case(s) tested against an in-memory fake `SessionRepository` — same pattern as `waitlist.test.ts`.
- `computeDodge` (button escape logic): pure-function unit tests covering empty/filled fields, the 2-dodge cap, and that a "keyboard" code path is never exercised (there isn't one to call).
- `back/architecture.test.ts` needs no changes — it already walks all of `back/domain/**` recursively, so `back/domain/auth` is covered for free.
- No automated test attempts to render real WebGL/Three.js output (not practical in jsdom); the 3D experience and the full flow are verified manually in a real browser (desktop, mobile viewport, `prefers-reduced-motion`, and a forced GLB-load-failure case) before this is called done.
- The happy-path throw sequence specifically cannot be fully verified until `chef.glb` is actually placed at `/public/models/chef.glb` — this is called out explicitly rather than assumed to work.

## Out of scope (deliberately deferred)

- Sign-up/registration, password reset, any provider other than email/password.
- Real Firestore-backed session validation, Tenant/Owner/Store lookups.
- Middleware-based route protection (fine with one protected route; revisit when there are more).
- The real product dashboard (only a placeholder exists).
- Any additional animation clips (`celebrate`, `confused`, `cover_eyes`, ...) beyond the four that already exist in the GLB.
- Enabling Authentication on the real `nextfood-76bc3` Firebase project.
