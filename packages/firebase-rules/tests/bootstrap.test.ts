import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createTestEnv, seedTenant } from "./helpers";

/**
 * Bootstrap is the classic deny-by-default chicken-and-egg problem: the
 * creator of a brand-new tenant has no membership doc yet. The rules use
 * getAfter() so that the tenant doc and the owner's membership doc can
 * only ever be created together, atomically — a lone write of either one
 * is rejected, so a partially-created ("orphaned") tenant is impossible.
 */
describe("tenant + owner membership bootstrap", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await createTestEnv();
  });

  afterEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it("denies creating the tenant doc alone, without the owner membership doc", async () => {
    const uid = "solo-creator";
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(
      setDoc(doc(db, "tenants", "lonely-tenant"), {
        ownerId: uid,
        name: "Lonely",
        createdAt: serverTimestamp(),
      }),
    );
  });

  it("denies creating the owner membership doc alone, without the tenant doc existing", async () => {
    const uid = "solo-member";
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(
      setDoc(doc(db, "tenants", "no-such-tenant", "members", uid), {
        role: "owner",
        createdAt: serverTimestamp(),
      }),
    );
  });

  it("succeeds when both docs are created together in one atomic batch", async () => {
    const uid = "batch-creator";
    const tenantId = "batch-tenant";
    const db = testEnv.authenticatedContext(uid).firestore();

    const batch = writeBatch(db);
    batch.set(doc(db, "tenants", tenantId), {
      ownerId: uid,
      name: "Batch Tenant",
      createdAt: serverTimestamp(),
    });
    batch.set(doc(db, "tenants", tenantId, "members", uid), {
      role: "owner",
      createdAt: serverTimestamp(),
    });
    await assertSucceeds(batch.commit());

    let tenantExists = false;
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const snap = await getDoc(doc(ctx.firestore(), "tenants", tenantId));
      tenantExists = snap.exists();
    });
    expect(tenantExists).toBe(true);
  });

  it("denies a batch that creates the tenant doc but assigns a different uid as the member (mismatched bootstrap)", async () => {
    const uid = "batch-creator-2";
    const otherUid = "someone-else";
    const tenantId = "mismatched-tenant";
    const db = testEnv.authenticatedContext(uid).firestore();

    const batch = writeBatch(db);
    batch.set(doc(db, "tenants", tenantId), {
      ownerId: uid,
      name: "Mismatched",
      createdAt: serverTimestamp(),
    });
    batch.set(doc(db, "tenants", tenantId, "members", otherUid), {
      role: "owner",
      createdAt: serverTimestamp(),
    });
    await assertFails(batch.commit());
  });

  it("denies a user self-declaring ownership of a tenant that already belongs to someone else", async () => {
    const realOwner = "real-owner";
    const attacker = "attacker";
    const tenantId = "existing-tenant";
    await seedTenant(testEnv, tenantId, realOwner);

    const asAttacker = testEnv.authenticatedContext(attacker).firestore();
    await assertFails(
      setDoc(doc(asAttacker, "tenants", tenantId, "members", attacker), {
        role: "owner",
        createdAt: serverTimestamp(),
      }),
    );
  });
});
