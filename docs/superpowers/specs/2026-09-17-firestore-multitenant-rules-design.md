# Firestore multi-tenant security rules — design

Status: approved for implementation
Date: 2026-09-17
Related: [requirements/non-functional/RNF-SEC-001.md](../../../requirements/non-functional/RNF-SEC-001.md), [architecture/system.md](../../../architecture/system.md)

## Context

The NextFood Firebase project (`nextfood-76bc3`) was audited on 2026-09-17: Authentication, Firestore and Storage were never initialized (no config, no data, Spark/free billing plan). `architecture/system.md` currently documents PostgreSQL + Prisma as the system of record; this spec formalizes a pivot — **Firestore becomes the primary data store** for NextFood. `architecture/system.md` will be updated as part of this change to remove the stale PostgreSQL/Prisma statement and describe Firestore instead.

This spec covers only the **data model and security rules foundation**: collection layout, authorization mechanism, RBAC, and automated rule tests. It does not implement application code, Authentication UI, or actual business domains (orders/stock/cashier) beyond one representative collection (`orders`) used to prove the pattern.

Hard constraints from the audit and from the product owner:
- Project stays on the **Spark (free) plan**. No dependency introduced here may require Blaze (no Cloud Functions, no App Hosting, no Storage bucket provisioning).
- Nothing is deployed to the real `nextfood-76bc3` project. All work is local config + emulator tests, on a branch, via PR.
- RNF-SEC-001: no authenticated user may read, create, update or delete another tenant's data; automated tests must prove cross-tenant access attempts fail; absence of tenant filtering is a blocking finding in review.

## Data model

Collections are nested by path, mirroring the Platform → Tenant → Store hierarchy:

```
/platform/{docId}                                             # public reference data (read-only, Admin SDK writes only)
/tenants/{tenantId}                                            # { ownerId, name, createdAt }
/tenants/{tenantId}/members/{uid}                               # tenant-level membership: { role: 'owner'|'admin', createdAt }
/tenants/{tenantId}/stores/{storeId}                            # { name, createdBy, createdAt }
/tenants/{tenantId}/stores/{storeId}/members/{uid}               # store-level membership: { role: 'admin'|'staff', createdAt }
/tenants/{tenantId}/stores/{storeId}/orders/{orderId}            # representative business collection (see below)
```

**Core security principle:** `tenantId` and `storeId` are never read from a field inside a document for authorization purposes — they come from the request **path**, which the client cannot forge. Every rule that grants access to a tenant/store-scoped document checks for the existence of a membership document at that exact path (`/tenants/$(tenantId)/members/$(uid)` or `/tenants/$(tenantId)/stores/$(storeId)/members/$(uid)`). This directly satisfies "don't trust a client-sent tenantId" — there is nothing client-sent to trust.

Business documents (e.g. `orders`) still carry denormalized `tenantId`/`storeId`/`createdBy`/`createdAt` fields for future `collectionGroup` queries and auditing, but these fields are **write-once and permanently immutable** after creation, validated against the path/auth context at create time, for every role including tenant owner. Nobody can rewrite a document's tenant, store, author, or creation time after the fact.

## Authorization mechanism: membership documents, not custom claims

Membership is resolved by reading Firestore membership documents inside the rule (`exists()`/`get()`), not by Firebase Auth custom claims on the ID token. Rationale:
- **Instant revocation.** Removing a member takes effect on the very next request. Custom claims are cached in the ID token for up to 1 hour (or until forced refresh), which is an unacceptable gap for "completely prevent cross-tenant access."
- **No extra infrastructure.** Custom claims require a trusted backend (Admin SDK) to set them. Today there is no backend wired into this repo; membership documents can be created directly by client-side flows that the rules themselves validate.
- **No 1000-byte token payload ceiling** to worry about as the number of tenants/stores grows.
- Cost: `get()`/`exists()` calls are billed reads, but Firestore caches repeated identical `get()` calls within one rule evaluation, and Spark's free 50k reads/day is far beyond this stage's needs.

This is a deliberate, revisitable trade-off: if read costs become material at scale, a derived custom-claims cache (populated by a backend job) can be layered on top later without changing the membership documents that remain the source of truth.

## RBAC

| Role | Scope | Can |
|---|---|---|
| `owner` | tenant | Everything in the tenant: manage members, stores, delete the tenant |
| `admin` | tenant | Manage stores, store members, business data across all stores; cannot delete the tenant or touch tenant-level membership (owner-only) |
| `admin` | store | Manage that store's members and business data (including privileged fields) |
| `staff` | store | Read/create business data in that store; update only a whitelisted set of operational fields; cannot delete, cannot manage members |

A tenant-level `owner`/`admin` automatically has access to every store under that tenant (checked first, before falling back to store-level membership). A store-level `admin`/`staff` only has access to the store(s) they are explicitly a member of. This gives both tenant isolation and store isolation.

## Field-level write protection (adjustment from review)

Staff must **not** get a blanket "update any field" permission on business documents. `orders` rules use `request.resource.data.diff(resource.data).affectedKeys().hasOnly([...])` (Firestore's documented whitelist pattern) to enforce, per role, exactly which fields may change in a single update:

- **Immutable for everyone, always:** `tenantId`, `storeId`, `createdBy`, `createdAt` — identity and audit trail, never rewritable regardless of role.
- **Staff-editable whitelist:** `status`, `notes`, `updatedBy`, `updatedAt` — operational fields only. `updatedBy` must equal `request.auth.uid` and `updatedAt` must equal `request.time`, so staff cannot forge who/when.
- **Owner/admin (tenant or store) whitelist:** the staff set **plus** `totalAmount`, `paymentStatus` — financial and payment fields are gated to privileged roles only.

This pattern (immutable-fields helper + role-scoped `hasOnly` whitelist) is the template for every future business collection (products, stock movements, cashier sessions, payments): define which fields are financial/ownership/audit (always protected) and which operational fields staff may touch, then reuse the same two helper functions.

## Bootstrap: atomic tenant + owner membership creation

Problem: with deny-by-default rules, creating a brand-new tenant is a chicken-and-egg problem — the creator has no membership yet, so no rule would normally permit the first write.

Investigated and verified against Firebase's official docs before implementing (rules behavior here is easy to get subtly wrong): a plain `get()` inside a security rule does **not** see sibling writes that are still pending in the same batch/transaction — it only sees already-committed state. The documented primitive for this exact scenario is `getAfter()`, which evaluates a referenced document's state **after the whole atomic operation completes, but before it commits**, and is explicitly documented for enforcing "these writes must happen together" ([Access other documents / getAfter](https://firebase.google.com/docs/firestore/enterprise/transactions)).

This means the rules don't just *document* that clients should use a batch — they **enforce** atomicity:

- `create` on `/tenants/{tenantId}` is only allowed if, by the end of the atomic operation, `getAfter()` on `/tenants/{tenantId}/members/{request.auth.uid}` shows a document with `role == 'owner'`.
- `create` on `/tenants/{tenantId}/members/{request.auth.uid}` (self, role `owner`) is only allowed if, by the end of the atomic operation, `getAfter()` on `/tenants/{tenantId}` shows `ownerId == request.auth.uid`.

Each rule alone is unsatisfiable by a lone write — only a `writeBatch()` (or transaction) containing both writes together can satisfy both conditions simultaneously. A partial bootstrap (only the tenant doc, or only the membership doc) is rejected by rules, not just discouraged by convention — this is what "avoid an orphaned tenant if one operation fails" means here: the failure mode is structurally impossible, not just unlikely. The client-side helper for this flow must use `writeBatch(db)` (no prior reads needed, so a transaction is unnecessary overhead), documented and tested in the rules test suite.

## Storage rules: prepared, not enforced

`storage.rules` is written now — deny-by-default, mirroring the same `/tenants/{tenantId}/stores/{storeId}/...` path convention — but it is intentionally **not** given full tenant/store-membership enforcement in this pass, and is **not** referenced by any emulator test.

Reason: the natural way to check Firestore membership from Storage rules is a cross-service lookup, and I could not confirm its exact syntax against current Firebase documentation in this session. Rather than ship an unverified security-critical pattern, or introduce a Blaze-only Cloud Function to mirror membership into custom claims for Storage's own use, this is deliberately deferred. Storage is not provisioned in this project (`0 buckets`, confirmed in the 2026-09-17 audit) and `storage.rules` is not referenced by `firebase deploy` in this change, so nothing is exposed by shipping a conservative skeleton now. The file requires `request.auth != null` at minimum and documents (in a comment) that real tenant/store enforcement must be verified and added before Storage is ever provisioned.

## File layout

```
firebase.json                     # firestore + storage config, emulator ports (firestore + auth only)
.firebaserc                       # { "projects": { "default": "nextfood-76bc3" } }
firestore.rules
firestore.indexes.json            # empty — no real queries exist in app code yet; add indexes as queries are built
storage.rules                     # prepared, not enforced (see above)
packages/firebase-rules/          # new pnpm workspace package
  package.json                    # devDeps: firebase-tools, firebase, @firebase/rules-unit-testing, vitest
  vitest.config.ts
  tests/
    bootstrap.test.ts             # tenant+owner atomic creation, orphan-prevention
    tenant-isolation.test.ts      # RNF-SEC-001: Tenant A cannot touch Tenant B (mandatory scenario)
    store-isolation.test.ts       # store-scoped staff cannot touch another store in the same tenant
    rbac.test.ts                  # owner/admin/staff permission matrix, field whitelists
    unauthenticated.test.ts       # deny-by-default baseline
```

`packages/firebase-rules` fits the existing pnpm workspace (`packages/*` is already a configured workspace glob) and uses Vitest to match the project's existing test tooling (`apps/web` already standardized on it).

## Testing strategy

All tests run against the real Firestore Emulator (not mocked), via `@firebase/rules-unit-testing`'s `initializeTestEnvironment`, driven by `firebase emulators:exec --only firestore,auth "vitest run"`. Fixture data (e.g. "Tenant B already has an order") is seeded with `testEnv.withSecurityRulesDisabled(...)`, so fixture setup never depends on the rules being tested. Each test clears Firestore state (`testEnv.clearFirestore()`) between cases for isolation.

Mandatory scenarios (superset of what RNF-SEC-001 requires):
1. **Cross-tenant (required by product owner):** a user who is a member of Tenant A cannot `get`, `list`, `create`, `update`, or `delete` any document under Tenant B (tenant doc, members, stores, orders) — each verb gets its own assertion.
2. **Cross-store within the same tenant:** a store-scoped `staff`/`admin` of Store 1 cannot read/write Store 2's data, even though both stores share a tenant.
3. **Unauthenticated baseline:** every collection denies unauthenticated reads/writes.
4. **Bootstrap atomicity:** a lone `create` of the tenant doc fails; a lone `create` of the owner membership doc fails; a batched write containing both succeeds; a user cannot self-declare ownership of a pre-existing tenant they don't own.
5. **RBAC / field whitelist:** staff can update `status`/`notes` on an order; staff updating `totalAmount` or `paymentStatus` is denied; store/tenant admin can update `totalAmount`; nobody (including owner) can change `tenantId`/`storeId`/`createdBy`/`createdAt` on an existing order; only tenant owner can delete a tenant; staff cannot delete an order or manage members.

A PR that weakens tenant or store isolation is expected to fail this suite — that is the enforcement mechanism requested for CI.

## CI

`.github/workflows/ci.yml` gets a new step that installs Java (required by the Firestore Emulator; already present locally but not guaranteed on `ubuntu-latest` without explicit setup) and runs `pnpm --filter firebase-rules test`, placed alongside the existing typecheck/unit-test/build steps so a broken rule fails the same required check other PRs already go through.

## Out of scope (deliberately deferred)

- Wiring actual application code (Next.js) to Firebase Auth/Firestore — this spec is the rules/config foundation only.
- Full Storage enforcement (see above) — needs verified cross-service rule syntax or a claims-sync mechanism, and a Blaze upgrade, neither of which exists yet.
- Additional business domains (products, stock movements, cashier sessions, payments) — they reuse the `orders` pattern (immutable identity/audit fields, role-scoped field whitelist) when implemented.
- Platform-level admin console / cross-tenant support tooling — explicitly rejected in favor of absolute isolation (any admin access happens via Admin SDK outside client rules, never modeled here).
- Composite Firestore indexes — added when real queries exist.
