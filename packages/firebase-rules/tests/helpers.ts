import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type RulesTestEnvironment,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = resolve(__dirname, "../../../firestore.rules");
const PROJECT_ID = "demo-nextfood";

export async function createTestEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(RULES_PATH, "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
}

/**
 * Seeds a tenant and its owner membership doc, bypassing security rules.
 * Used to set up fixtures; the rules themselves are exercised in
 * bootstrap.test.ts via real (non-bypassed) writes.
 */
export async function seedTenant(
  testEnv: RulesTestEnvironment,
  tenantId: string,
  ownerId: string,
) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "tenants", tenantId), {
      ownerId,
      name: `Tenant ${tenantId}`,
      createdAt: serverTimestamp(),
    });
    await setDoc(doc(db, "tenants", tenantId, "members", ownerId), {
      role: "owner",
      createdAt: serverTimestamp(),
    });
  });
}

export async function seedTenantMember(
  testEnv: RulesTestEnvironment,
  tenantId: string,
  uid: string,
  role: "owner" | "admin",
) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "tenants", tenantId, "members", uid), {
      role,
      createdAt: serverTimestamp(),
    });
  });
}

export async function seedStore(
  testEnv: RulesTestEnvironment,
  tenantId: string,
  storeId: string,
  createdBy: string,
) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "tenants", tenantId, "stores", storeId), {
      name: `Store ${storeId}`,
      createdBy,
      createdAt: serverTimestamp(),
    });
  });
}

export async function seedStoreMember(
  testEnv: RulesTestEnvironment,
  tenantId: string,
  storeId: string,
  uid: string,
  role: "admin" | "staff",
) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(
      doc(ctx.firestore(), "tenants", tenantId, "stores", storeId, "members", uid),
      { role, createdAt: serverTimestamp() },
    );
  });
}

export async function seedOrder(
  testEnv: RulesTestEnvironment,
  tenantId: string,
  storeId: string,
  orderId: string,
  createdBy: string,
  overrides: Record<string, unknown> = {},
) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(
      doc(ctx.firestore(), "tenants", tenantId, "stores", storeId, "orders", orderId),
      {
        tenantId,
        storeId,
        createdBy,
        createdAt: serverTimestamp(),
        updatedBy: createdBy,
        updatedAt: serverTimestamp(),
        status: "open",
        notes: "",
        totalAmount: 42,
        paymentStatus: "pending",
        ...overrides,
      },
    );
  });
}
