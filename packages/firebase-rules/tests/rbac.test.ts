import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, afterEach, beforeAll, describe, it } from "vitest";
import {
  createTestEnv,
  seedOrder,
  seedStore,
  seedStoreMember,
  seedTenant,
  seedTenantMember,
} from "./helpers";

describe("RBAC and field-level write protection", () => {
  let testEnv: RulesTestEnvironment;

  const tenantId = "tenant-rbac";
  const ownerUid = "owner-rbac";
  const tenantAdminUid = "tenant-admin-rbac";
  const storeId = "store-rbac";
  const storeAdminUid = "store-admin-rbac";
  const staffUid = "staff-rbac";
  const orderId = "order-rbac";

  beforeAll(async () => {
    testEnv = await createTestEnv();
  });

  afterEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  async function seedFixture() {
    await seedTenant(testEnv, tenantId, ownerUid);
    await seedTenantMember(testEnv, tenantId, tenantAdminUid, "admin");
    await seedStore(testEnv, tenantId, storeId, ownerUid);
    await seedStoreMember(testEnv, tenantId, storeId, storeAdminUid, "admin");
    await seedStoreMember(testEnv, tenantId, storeId, staffUid, "staff");
    await seedOrder(testEnv, tenantId, storeId, orderId, ownerUid);
  }

  it("allows staff to update whitelisted operational fields (status, notes)", async () => {
    await seedFixture();
    const asStaff = testEnv.authenticatedContext(staffUid).firestore();
    await assertSucceeds(
      updateDoc(doc(asStaff, "tenants", tenantId, "stores", storeId, "orders", orderId), {
        status: "preparing",
        notes: "extra guarana",
        updatedBy: staffUid,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("denies staff updating the financial field totalAmount", async () => {
    await seedFixture();
    const asStaff = testEnv.authenticatedContext(staffUid).firestore();
    await assertFails(
      updateDoc(doc(asStaff, "tenants", tenantId, "stores", storeId, "orders", orderId), {
        totalAmount: 999,
        updatedBy: staffUid,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("denies staff updating paymentStatus", async () => {
    await seedFixture();
    const asStaff = testEnv.authenticatedContext(staffUid).firestore();
    await assertFails(
      updateDoc(doc(asStaff, "tenants", tenantId, "stores", storeId, "orders", orderId), {
        paymentStatus: "paid",
        updatedBy: staffUid,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("allows a store admin to update totalAmount", async () => {
    await seedFixture();
    const asStoreAdmin = testEnv.authenticatedContext(storeAdminUid).firestore();
    await assertSucceeds(
      updateDoc(doc(asStoreAdmin, "tenants", tenantId, "stores", storeId, "orders", orderId), {
        totalAmount: 55,
        updatedBy: storeAdminUid,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("allows a tenant admin to update totalAmount on any store's order", async () => {
    await seedFixture();
    const asTenantAdmin = testEnv.authenticatedContext(tenantAdminUid).firestore();
    await assertSucceeds(
      updateDoc(doc(asTenantAdmin, "tenants", tenantId, "stores", storeId, "orders", orderId), {
        totalAmount: 77,
        updatedBy: tenantAdminUid,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("denies changing tenantId/storeId/createdBy/createdAt on an existing order, even for the tenant owner", async () => {
    await seedFixture();
    const asOwner = testEnv.authenticatedContext(ownerUid).firestore();
    await assertFails(
      updateDoc(doc(asOwner, "tenants", tenantId, "stores", storeId, "orders", orderId), {
        tenantId: "some-other-tenant",
        updatedBy: ownerUid,
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(asOwner, "tenants", tenantId, "stores", storeId, "orders", orderId), {
        createdBy: "someone-else",
        updatedBy: ownerUid,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("denies staff from deleting an order", async () => {
    await seedFixture();
    const asStaff = testEnv.authenticatedContext(staffUid).firestore();
    await assertFails(deleteDoc(doc(asStaff, "tenants", tenantId, "stores", storeId, "orders", orderId)));
  });

  it("allows a store admin to delete an order", async () => {
    await seedFixture();
    const asStoreAdmin = testEnv.authenticatedContext(storeAdminUid).firestore();
    await assertSucceeds(deleteDoc(doc(asStoreAdmin, "tenants", tenantId, "stores", storeId, "orders", orderId)));
  });

  it("denies staff from creating a store member (privilege escalation attempt)", async () => {
    await seedFixture();
    const asStaff = testEnv.authenticatedContext(staffUid).firestore();
    await assertFails(
      setDoc(doc(asStaff, "tenants", tenantId, "stores", storeId, "members", "new-friend"), {
        role: "admin",
        createdAt: serverTimestamp(),
      }),
    );
  });

  it("allows a store admin to add a new staff member to their store", async () => {
    await seedFixture();
    const asStoreAdmin = testEnv.authenticatedContext(storeAdminUid).firestore();
    await assertSucceeds(
      setDoc(doc(asStoreAdmin, "tenants", tenantId, "stores", storeId, "members", "new-staff"), {
        role: "staff",
        createdAt: serverTimestamp(),
      }),
    );
  });

  it("denies a tenant admin from deleting the tenant (owner-only)", async () => {
    await seedFixture();
    const asTenantAdmin = testEnv.authenticatedContext(tenantAdminUid).firestore();
    await assertFails(deleteDoc(doc(asTenantAdmin, "tenants", tenantId)));
  });

  it("allows the tenant owner to delete the tenant", async () => {
    await seedFixture();
    const asOwner = testEnv.authenticatedContext(ownerUid).firestore();
    await assertSucceeds(deleteDoc(doc(asOwner, "tenants", tenantId)));
  });

  it("denies a store admin from promoting a store member to a tenant-level role", async () => {
    await seedFixture();
    const asStoreAdmin = testEnv.authenticatedContext(storeAdminUid).firestore();
    await assertFails(
      setDoc(doc(asStoreAdmin, "tenants", tenantId, "stores", storeId, "members", "sneaky"), {
        role: "owner",
        createdAt: serverTimestamp(),
      }),
    );
  });
});
