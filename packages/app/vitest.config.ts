import { defineConfig } from "vitest/config";
import { copiedFrontAliases } from "../../src/components/vitest.alias.ts";

// Unit tests of the host's pure parts; the pages run in e2e/ on next start.
export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  resolve: { alias: copiedFrontAliases },
  test: { include: ["src/**/*.test.ts", "test-fakes/**/*.test.ts"] },
});
