import { defineConfig } from "vitest/config";

import { copiedFrontAliases } from "./vitest.alias.ts";
import nezaporteno from "./vitest.nezaporteno.json" with { type: "json" };

const NEPORTIRANO = Object.values(nezaporteno.skupine).flat();

export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  resolve: { alias: copiedFrontAliases },
  test: { environment: "node", include: ["**/*.test.{ts,tsx}"], exclude: ["**/node_modules/**", ...NEPORTIRANO] },
});
