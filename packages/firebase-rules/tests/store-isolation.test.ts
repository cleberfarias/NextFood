import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createTestEnv, seedOrder, seedStore, seedStoreMember, seedTenant } from "./helpers";

/**
 * A store-scoped user (staff/admin without tenant-level membership) must
 * only access the store(s) they are explicitly a member of — not other
 * stores under the same tenant.
 */
describe("cross-store isolation within the same tenant", () => {
  let testEnv: RulesTestEnvironment;

  const tenantX = "tenant-x";
  const ownerX = "owner-x";
  const store1 = "store-1";
  const store2 = "store-2";
  const staff1 = "staff-store-1";
  const order2 = "order-2a";

  beforeAll(async () => {
    testEnv = await createTestEnv();
  });

  afterEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  async function seedTenantWithTwoStores() {
    await seedTenant(testEnv, tenantX, ownerX);
    await seedStore(testEnv, tenantX, store1, ownerX);
    await seedStore(testEnv, tenantX, store2, ownerX);
    await seedStoreMember(testEnv, tenantX, store1, staff1, "staff");
    await seedOrder(testEnv, tenantX, store2, order2, ownerX);
  }

  it("denies a Store 1 staff member from reading a Store 2 order", async () => {
    await seedTenantWithTwoStores();
    const asStaff1 = testEnv.authenticatedContext(staff1).firestore();
    await assertFails(getDoc(doc(asStaff1, "tenants", tenantX, "stores", store2, "orders", order2)));
  });

  it("denies a Store 1 staff member from updating a Store 2 order", async () => {
    await seedTenantWithTwoStores();
    const asStaff1 = testEnv.authenticatedContext(staff1).firestore();
    await assertFails(
      updateDoc(doc(asStaff1, "tenants", tenantX, "stores", store2, "orders", order2), {
        status: "cancelled",
        updatedBy: staff1,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("denies a Store 1 staff member from reading the Store 2 doc itself", async () => {
    await seedTenantWithTwoStores();
    const asStaff1 = testEnv.authenticatedContext(staff1).firestore();
    await assertFails(getDoc(doc(asStaff1, "tenants", tenantX, "stores", store2)));
  });

  it("allows the Store 1 staff member to read their own store's data (control case)", async () => {
    await seedTenantWithTwoStores();
    const asStaff1 = testEnv.authenticatedContext(staff1).firestore();
    const snap = await assertSucceeds(getDoc(doc(asStaff1, "tenants", tenantX, "stores", store1)));
    expect(snap.exists()).toBe(true);
  });

  it("allows the tenant owner to read every store, including ones they have no explicit store-membership doc for", async () => {
    await seedTenantWithTwoStores();
    const asOwner = testEnv.authenticatedContext(ownerX).firestore();
    await assertSucceeds(getDoc(doc(asOwner, "tenants", tenantX, "stores", store2, "orders", order2)));
  });
});
