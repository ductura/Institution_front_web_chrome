import { defineConfig } from "vitest/config";

// Static build of the catalogue; no server calls, fonts are bundled files.
export default defineConfig({
  base: "./",
  oxc: { jsx: { runtime: "automatic" } },
  // Screens that read the Next router get a router that stays put (src/next-navigation.ts).
  resolve: { alias: { "next/navigation": "/src/next-navigation.ts" } },
  test: { include: ["src/**/*.test.ts"] },
});
