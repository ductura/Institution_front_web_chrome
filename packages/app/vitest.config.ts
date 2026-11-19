import { defineConfig } from "vitest/config";

// Unit tests of the host's pure parts; the pages run in e2e/ on next start.
export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  test: { include: ["src/**/*.test.ts"] },
});
