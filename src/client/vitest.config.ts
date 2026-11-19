import { defineConfig } from "vitest/config";

import { copiedFrontAliases } from "../components/vitest.alias";

// The code ported from Ductus 0cdb0f1 (the evidence modules, the editor-core
// files they reach and the editor's evidence session they type against)
// imports through the Ductus "@/" alias. The runtime twin of the "paths" in
// tsconfig.json is the one src/components already uses, so both read "@/"
// the same way. One copy of dexie and fake-indexeddb, the client's own, also
// for editor-core's journal under these tests.
export default defineConfig({
  resolve: { alias: copiedFrontAliases, dedupe: ["dexie", "fake-indexeddb"] },
  test: { environment: "node" },
});
