import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    hookTimeout: 20000,
    testTimeout: 20000,
    // All test files share one Firestore emulator instance/project id.
    // Running files in parallel causes lock contention between unrelated
    // suites (concurrent batched writes/transactions time out each
    // other). Keep this sequential.
    fileParallelism: false,
  },
});
