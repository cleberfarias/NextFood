# apps/web front/back architecture — design

Status: approved for implementation
Date: 2026-09-17
Related: [architecture/system.md](../../../architecture/system.md), [2026-09-17-firestore-multitenant-rules-design.md](2026-09-17-firestore-multitenant-rules-design.md)

## Context

`apps/web` today is a single, undifferentiated Next.js App Router project (one `page.tsx`, one `layout.tsx`, no shared component layer, no domain layer). This spec introduces a `front/` + `back/` code-organization split **inside the existing Next.js app** — not a new service, not a new deploy target. Next.js remains the only server; `front/` and `back/` are how code is organized within it.

This is strictly an **architecture/tooling** change. It does not implement Authentication, onboarding, or Tenant/Owner/Store creation — that is the next, separate increment.

## Directory layout

```
apps/web/
  app/                            # Next.js routing ONLY: layouts, pages, route boundaries, composition
  front/
    ui/                           # shadcn/ui + Radix primitives ONLY (button, input, label, card, alert...)
    features/
      <feature>/                  # feature-specific components, hooks, client behavior
  back/
    domain/
      <feature>/                  # business rules. Zero imports of firebase-admin, next, react.
    data/
      <feature>/                  # adapters implementing domain ports (Firestore via Admin SDK)
    actions/
      <feature>.ts                # Server Actions: validate -> authorize -> execute -> handle/revalidate
    schemas/
      <feature>.ts                # zod contracts for Server Action *input* (form/action shape)
    lib/
      firebase-admin.ts           # Admin SDK singleton, server-only, lazy-initialized
    architecture.test.ts          # static check: back/domain never imports firebase-admin/next/react
```

`front/ui` holds only reusable, feature-agnostic design-system primitives. Anything specific to one feature's behavior or copy lives in `front/features/<feature>/`, never in `front/ui`. `app/` composes `front/features/*` components into pages; it does not contain feature JSX/logic itself.

## Dependency direction (the rule everything else follows)

```
app/            -> front/features/*, back/actions/*
front/features  -> front/ui/*, back/actions/* (calls only), back/schemas/* (types only)
back/actions    -> back/domain/*, back/data/* (wires a concrete adapter into a use case), back/schemas/*
back/domain     -> nothing outside itself. No firebase-admin, no next, no react. Depends only on
                   the ports (interfaces) it declares.
back/data       -> implements back/domain's ports. Imports firebase-admin. Never imported by back/domain.
```

`back/domain` owns its contracts (ports): a repository *interface* per aggregate lives next to its use cases in `back/domain/<feature>/`. `back/data/<feature>/` provides the Firestore-backed implementation. `back/actions` is the only place that wires a concrete `back/data` adapter into a `back/domain` use case — domain code never knows Firestore exists.

This is enforced two ways:
1. **Structurally**: domain modules simply have no reason to import `firebase-admin`/`next`/`react` if they only deal in plain TS types, ports, and use-case functions.
2. **By test**: `back/architecture.test.ts` statically scans every file under `back/domain/**` for those import specifiers and fails the suite if any are found — see Testing below.

## Server Actions: the contract every action follows

Every Server Action in `back/actions/`:
1. **Validates input** against a zod schema from `back/schemas/` (never trusts raw `FormData`/client payload shape).
2. **Resolves authorization server-side** when applicable — session, role, tenant/store membership are re-derived from trusted server state, never taken from a client-sent `tenantId`/`storeId`/`role` field. An action that is intentionally public (no auth exists to check) must say so in a comment, not silently skip the step.
3. **Executes the domain use case**, injecting a concrete `back/data` adapter.
4. **Handles the result**: maps domain errors to a serializable, user-facing shape; calls `revalidatePath`/`revalidateTag` when the action affects data rendered elsewhere.
5. **Returns a plain object** shaped for `useActionState` (`{ status: 'idle' | 'success' | 'error', message?, fieldErrors? }`) — never throws to the client.

Step 2 has no real implementation yet (no Auth phase exists). The one action this spec implements (`joinWaitlistAction`) is genuinely public, so step 2 is a one-line comment explaining why it's skipped — not a stub pretending auth exists. When the Auth phase lands, it defines the actual session/authorization resolver this step calls.

## Data fetching default

Server Components read data, Server Actions write it — the Next.js App Router default. This is **not a permanent restriction against the Firebase Client SDK**: real-time features (PDV, live order boards, open cashier sessions) will need `onSnapshot` and are expected to get their own client-side adapters in `front/features/<feature>/` using the Firebase Client SDK when those features are built. Nothing in this architecture blocks that; it simply isn't needed yet, so it isn't installed or configured yet.

## Firebase Admin SDK

`back/lib/firebase-admin.ts` lazily initializes a single Admin SDK app instance from environment variables (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`), documented in a new `.env.local.example` (never a committed `.env.local`). It is imported only from `back/data/**`, never from `back/domain/**` or `front/**`.

Because `nextfood-76bc3` has no Firestore database provisioned yet (see the 2026-09-17 audit) and this machine has no service account configured, calls through the Admin SDK will fail at runtime until both exist. Adapters must handle that failure gracefully (catch, return a domain-level error) rather than crash the page — this is standard practice regardless of today's provisioning state, not a special case. The page that uses this action is marked `export const dynamic = 'force-dynamic'` so `next build` never attempts to call Firestore at build time.

## Worked example: waitlist signup

To prove the pattern end-to-end without touching Auth/Tenant/Store, this spec migrates the current static homepage copy into `front/features/marketing/` and adds one real, small vertical slice: a public "join the waitlist" form on the homepage.

- `back/domain/waitlist/waitlist.ts` — `WaitlistSignup` type, `WaitlistRepository` port (`add`, `existsByEmail`), `joinWaitlist(repo, input)` use case: normalizes the email (trim/lowercase), rejects a duplicate with a domain error (`AlreadyOnWaitlistError`), otherwise adds the signup. Plain TypeScript, no zod, no framework — domain's own types are intentionally kept separate from the action's zod input schema (per review: don't put domain-only schemas next to form/UI detail).
- `back/domain/waitlist/waitlist.test.ts` — unit tests the use case against an in-memory fake `WaitlistRepository`. No Next.js, no Firebase, no emulator — plain Vitest, `@vitest-environment node`.
- `back/data/waitlist/firestore-waitlist-repository.ts` — implements `WaitlistRepository`, reading/writing `/platform/waitlistSignups/{id}` via Admin SDK (Admin SDK bypasses Firestore Security Rules entirely, so no `firestore.rules` change is needed for this write path).
- `back/schemas/waitlist.ts` — `waitlistSignupInputSchema` (email + business name): the action's input contract, separate from the domain's own type.
- `back/actions/waitlist.ts` — `joinWaitlistAction`, `'use server'`, following the 5-step contract above.
- `front/features/waitlist/waitlist-form.tsx` — client component, `useActionState(joinWaitlistAction, initialState)`, built from `front/ui` primitives (`Input`, `Button`, `Label`) plus feature-specific layout/copy.
- `front/features/marketing/hero.tsx` — the existing homepage marketing copy, moved out of `app/page.tsx`.
- `app/page.tsx` — becomes thin: composes `<Hero />` and `<WaitlistForm />`, `export const dynamic = 'force-dynamic'`.

No `firestore.rules` changes: `/platform/{docId}` already denies all client writes (Admin SDK only), which is exactly right for a Server-Action-only write path.

## UI library

shadcn/ui, base **Radix**, Tailwind v4 native support (confirmed against current shadcn docs — `tailwind.config` stays empty, `@import "tailwindcss"` in `globals.css` as already configured). `components.json`'s `aliases` are set so generated primitives land in `front/ui` (not the default `components/ui`). Icons: `lucide-react` (shadcn's default pairing). Path alias `@/*` added to `apps/web/tsconfig.json` pointing at the app root, giving imports like `@/front/ui/button`, `@/back/domain/waitlist/waitlist`.

## Forms

React 19's `useActionState` only — no React Hook Form. The waitlist form is simple enough (two fields) that manual `useActionState` + zod field-error mapping is sufficient; the spec explicitly keeps RHF out until a form's complexity actually justifies it, per review feedback.

## Testing

- `back/domain/waitlist/waitlist.test.ts`: proves domain testability in isolation (in-memory fake, `node` environment, no framework).
- `back/architecture.test.ts`: proves the dependency direction — walks `back/domain/**/*.ts` and fails if any file's import specifiers include `firebase-admin`, `next`, `next/*`, `react`, or `react/*`. Implemented with plain `node:fs`/`node:path`, no new dependency.
- Existing `apps/web` test (`app/page.test.tsx`) is updated to match the homepage's new composition (still exercised through Testing Library, unchanged approach).
- No Firestore-emulator integration test is added for `back/data/waitlist` in this pass — the adapter is thin (mostly boilerplate over Admin SDK calls); the meaningful logic lives in the domain layer, which is tested. This can be revisited if the adapter grows real logic.

## Out of scope (deliberately deferred)

- Authentication, sessions, and the real authorization resolver Server Actions will call in step 2 of their contract.
- Onboarding, Tenant/Owner/Store creation UI.
- Any Firebase Client SDK usage (real-time listeners) — the architecture allows it per-feature when needed, nothing is installed now.
- Firestore-emulator integration tests for `back/data` adapters.
- A design system beyond the handful of shadcn primitives the waitlist form needs (button, input, label, card/alert for the result message).
