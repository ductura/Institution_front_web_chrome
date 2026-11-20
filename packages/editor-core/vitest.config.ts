import { defineConfig } from "vitest/config";
import { copiedFrontAliases } from "../../src/components/vitest.alias.ts";

// Unit, property and vector tests of the package, as in Ductus (node, no DOM).
export default defineConfig({
  resolve: {
    alias: copiedFrontAliases,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Generated cases make repeated WebCrypto and IndexedDB calls. Explicit
    // deadlines and latency assertions still apply in the tests that set them.
    testTimeout: 15_000,
  },
});
