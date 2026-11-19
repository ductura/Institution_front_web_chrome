import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// WEB-38: the evidence modules import @ductura/editor-core by relative path,
// and a few of its files still import through the Ductus "@/" alias
// (serverSync/checkpoints.ts: "@/lib/i18n/hr"). "@/" is src/, as in
// src/components/vitest.alias.ts and the "paths" of tsconfig.ductus.json.
// Forward slashes keep the alias working on Windows.
const src = fileURLToPath(new URL("../", import.meta.url)).replaceAll("\\", "/");

export default defineConfig({
  resolve: { alias: [{ find: /^@\//, replacement: src.endsWith("/") ? src : `${src}/` }] },
  test: { environment: "node" },
});
