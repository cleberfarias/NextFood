import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { afterAll, afterEach, beforeAll, describe, it } from "vitest";
import { createTestEnv, seedOrder, seedStore, seedStoreMember, seedTenant } from "./helpers";

describe("deny-by-default for unauthenticated requests", () => {
  let testEnv: RulesTestEnvironment;

  const tenantId = "tenant-anon";
  const ownerId = "owner-anon";
  const storeId = "store-anon";
  const orderId = "order-anon";

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
    await seedTenant(testEnv, tenantId, ownerId);
    await seedStore(testEnv, tenantId, storeId, ownerId);
    await seedStoreMember(testEnv, tenantId, storeId, ownerId, "admin");
    await seedOrder(testEnv, tenantId, storeId, orderId, ownerId);
  }

  it("denies reading the tenant doc", async () => {
    await seedFixture();
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, "tenants", tenantId)));
  });

  it("denies listing orders", async () => {
    await seedFixture();
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDocs(collection(anon, "tenants", tenantId, "stores", storeId, "orders")));
  });

  it("denies creating a tenant", async () => {
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(doc(anon, "tenants", "anon-tenant"), {
        ownerId: "anon-user",
        name: "anon",
        createdAt: serverTimestamp(),
      }),
    );
  });

  it("denies writing an order", async () => {
    await seedFixture();
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(doc(anon, "tenants", tenantId, "stores", storeId, "orders", "anon-order"), {
        tenantId,
        storeId,
        createdBy: "anon-user",
        createdAt: serverTimestamp(),
        updatedBy: "anon-user",
        updatedAt: serverTimestamp(),
        status: "open",
        notes: "",
        totalAmount: 1,
        paymentStatus: "pending",
      }),
    );
  });

  it("denies writing platform config", async () => {
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(anon, "platform", "plans"), { tiers: [] }));
  });

  it("allows public read of platform config (intentionally open, by design)", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "platform", "plans"), { tiers: ["free"] });
    });
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(anon, "platform", "plans")));
  });
});
