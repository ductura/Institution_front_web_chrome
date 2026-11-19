import { defineConfig } from "vitest/config";

// Ductus 0cdb0f1f ran these as its "unit" and "property" projects; the
// property setup (FC_NUM_RUNS) is the copied tests/property/setup.ts.
export default defineConfig({
  test: {
    environment: "node",
    include: ["forbidden-terms/**/*.test.ts"],
    setupFiles: ["forbidden-terms/setup.ts"],
  },
});
