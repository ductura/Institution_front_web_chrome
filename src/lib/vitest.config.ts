import { defineConfig } from "vitest/config";

import { copiedFrontAliases } from "../components/vitest.alias.ts";

export default defineConfig({
  resolve: { alias: copiedFrontAliases },
  test: { environment: "node", include: ["**/*.test.ts"], exclude: ["**/node_modules/**"] },
});
