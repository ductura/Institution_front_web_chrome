import { defineConfig } from "vitest/config";

// The institution front, built once and served under /app/web/ (#2028
// c.6993786629 §1). dev-server.mjs serves the same build under /app/chrome/ as
// well; its assets stay under /app/web/, which the edge also routes here.
export default defineConfig({
  base: "/app/web/",
  oxc: { jsx: { runtime: "automatic" } },
  build: {
    emptyOutDir: true,
    // One bundle: the contract's OpenAPI document and the interface catalogue
    // are most of it, and both are read at start.
    chunkSizeWarningLimit: 1024,
    rolldownOptions: {
      // AppShell keeps Next's "use client" from its Ductus source; a plain
      // client bundle has no use for it.
      onwarn(warning, warn) {
        if (warning.code === "MODULE_LEVEL_DIRECTIVE") return;
        warn(warning);
      },
    },
  },
  test: { include: ["src/**/*.test.ts", "reference-report/**/*.test.ts"] },
});
