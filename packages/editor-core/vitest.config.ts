import { defineConfig } from "vitest/config";

// Unit, property and vector tests of the package, as in Ductus (node, no DOM).
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
