import { defineConfig } from "vitest/config";
import { copiedFrontAliases } from "../../src/components/vitest.alias";

// Unit, property and vector tests of the package, as in Ductus (node, no DOM).
export default defineConfig({
  resolve: {
    alias: copiedFrontAliases,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
