import { defineConfig } from "vitest/config";

// Static build of the catalogue; no server calls, fonts are bundled files.
export default defineConfig({
  base: "./",
  oxc: { jsx: { runtime: "automatic" } },
  test: { include: ["src/**/*.test.ts"] },
});
