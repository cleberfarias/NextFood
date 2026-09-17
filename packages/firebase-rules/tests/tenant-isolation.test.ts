import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, getDocs, collection, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createTestEnv, seedOrder, seedStore, seedStoreMember, seedTenant } from "./helpers";

/**
 * RNF-SEC-001: a user who belongs to Tenant A must never be able to read,
 * create, update, or delete data that belongs to Tenant B, even when they
 * know Tenant B's ids (tenantId/storeId/orderId are not secrets — the
 * membership check is what protects the data).
 */
describe("cross-tenant isolation (RNF-SEC-001)", () => {
  let testEnv: RulesTestEnvironment;

  const tenantA = "tenant-a";
  const userA = "user-a-owner";
  const tenantB = "tenant-b";
  const userB = "user-b-owner";
  const storeB = "store-b1";
  const orderB = "order-b1";

  beforeAll(async () => {
    testEnv = await createTestEnv();
  });

  afterEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  async function seedBothTenants() {
    await seedTenant(testEnv, tenantA, userA);
    await seedTenant(testEnv, tenantB, userB);
    await seedStore(testEnv, tenantB, storeB, userB);
    await seedStoreMember(testEnv, tenantB, storeB, userB, "admin");
    await seedOrder(testEnv, tenantB, storeB, orderB, userB);
  }

  it("denies reading Tenant B's tenant doc to a Tenant A member", async () => {
    await seedBothTenants();
    const asUserA = testEnv.authenticatedContext(userA).firestore();
    await assertFails(getDoc(doc(asUserA, "tenants", tenantB)));
  });

  it("denies listing Tenant B's members to a Tenant A member", async () => {
    await seedBothTenants();
    const asUserA = testEnv.authenticatedContext(userA).firestore();
    await assertFails(getDocs(collection(asUserA, "tenants", tenantB, "members")));
  });

  it("denies reading a Tenant B order to a Tenant A member", async () => {
    await seedBothTenants();
    const asUserA = testEnv.authenticatedContext(userA).firestore();
    await assertFails(getDoc(doc(asUserA, "tenants", tenantB, "stores", storeB, "orders", orderB)));
  });

  it("denies listing Tenant B's orders to a Tenant A member", async () => {
    await seedBothTenants();
    const asUserA = testEnv.authenticatedContext(userA).firestore();
    await assertFails(getDocs(collection(asUserA, "tenants", tenantB, "stores", storeB, "orders")));
  });

  it("denies creating an order under Tenant B to a Tenant A member", async () => {
    await seedBothTenants();
    const asUserA = testEnv.authenticatedContext(userA).firestore();
    await assertFails(
      setDoc(doc(asUserA, "tenants", tenantB, "stores", storeB, "orders", "intruder-order"), {
        tenantId: tenantB,
        storeId: storeB,
        createdBy: userA,
        createdAt: serverTimestamp(),
        updatedBy: userA,
        updatedAt: serverTimestamp(),
        status: "open",
        notes: "",
        totalAmount: 10,
        paymentStatus: "pending",
      }),
    );
  });

  it("denies updating a Tenant B order to a Tenant A member", async () => {
    await seedBothTenants();
    const asUserA = testEnv.authenticatedContext(userA).firestore();
    await assertFails(
      updateDoc(doc(asUserA, "tenants", tenantB, "stores", storeB, "orders", orderB), {
        status: "cancelled",
        updatedBy: userA,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("denies deleting a Tenant B order to a Tenant A member", async () => {
    await seedBothTenants();
    const asUserA = testEnv.authenticatedContext(userA).firestore();
    await assertFails(deleteDoc(doc(asUserA, "tenants", tenantB, "stores", storeB, "orders", orderB)));
  });

  it("denies deleting Tenant B itself to a Tenant A member", async () => {
    await seedBothTenants();
    const asUserA = testEnv.authenticatedContext(userA).firestore();
    await assertFails(deleteDoc(doc(asUserA, "tenants", tenantB)));
  });

  it("still allows Tenant B's own owner to read their own order (control case)", async () => {
    await seedBothTenants();
    const asUserB = testEnv.authenticatedContext(userB).firestore();
    const snap = await assertSucceeds(getDoc(doc(asUserB, "tenants", tenantB, "stores", storeB, "orders", orderB)));
    expect(snap.exists()).toBe(true);
  });
});
