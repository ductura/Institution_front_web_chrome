import { defineConfig } from "vitest/config";

import { copiedFrontAliases } from "./vitest.alias.ts";
import { NEPORTIRANO } from "./vitest.nezaporteno.ts";

export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  resolve: { alias: copiedFrontAliases },
  test: { environment: "node", include: ["**/*.test.{ts,tsx}"], exclude: ["**/node_modules/**", ...NEPORTIRANO] },
});
