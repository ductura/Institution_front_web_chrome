import { defineConfig } from "vitest/config";

import { copiedFrontAliases } from "../components/vitest.alias.ts";

// Tests of the copied pages.
export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  resolve: { alias: copiedFrontAliases },
  // The pages have no tests of their own yet.
  test: { passWithNoTests: true, environment: "node", include: ["**/*.test.{ts,tsx}"], exclude: ["**/node_modules/**"] },
});
