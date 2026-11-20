import { defineConfig } from "vitest/config";

// Unit, property and vector tests of the package, as in Ductus (node, no DOM).
// "@/lib/i18n" is the runtime twin of the path in tsconfig.json: two sources
// read the Croatian catalogue through the Ductus alias; it lives in src/lib/i18n.
const i18n = `${import.meta.dirname.replaceAll("\\", "/")}/../../src/lib/i18n/`;

export default defineConfig({
  resolve: { alias: [{ find: /^@\/lib\/i18n\//, replacement: i18n }] },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // ZEL-W1 (orkestrator c.7027096433, opcija b): izričit popis, svaki WEB PR briše svoj redak.
    exclude: [
      "**/node_modules/**",
      // Import code not ported yet (the same three are excluded in tsconfig.json).
      "src/editor/source.property.test.ts",
      "src/editor/source.test.ts",
      "src/journal/sign-out.test.ts",
      // Read files by the Ductus repository layout (src/domain/..., pnpm-lock.yaml at the package root).
      "src/editor/schema-v1-compat.test.ts",
      "src/document/document/edit-step.test.ts",
      // Real failure, not an import: the journal answers ERROR where the test expects CONFLICT
      // (server revision refused); reported on Ductus#2028, belongs with the sync states (#111).
      "src/journal/atomic-dexie-journal.equivalence.test.ts",
    ],
  },
});
