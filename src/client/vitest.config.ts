import { defineConfig } from "vitest/config";

import { copiedFrontAliases } from "../components/vitest.alias";

// The code ported from Ductus 0cdb0f1 (the evidence modules, the editor-core
// files they reach and the editor's evidence session they type against)
// imports through the Ductus "@/" alias. The runtime twin of the "paths" in
// tsconfig.json is the one src/components already uses, so both read "@/"
// the same way. One copy of dexie and fake-indexeddb, the client's own, also
// for editor-core's journal under these tests.
//
// One copy of ProseMirror as well: editor-core (the workspace install) and this
// package's own install each carry a prosemirror-model, and a Transform from
// one with a schema from the other cannot split a block ("Can not convert <>
// to a Fragment"). The "@tiptap/pm" imports here are pinned to editor-core's.
const editorCorePm = decodeURIComponent(new URL("../../packages/editor-core/node_modules/@tiptap/pm", import.meta.url).pathname);

export default defineConfig({
  resolve: {
    alias: [{ find: /^@tiptap\/pm(?=\/|$)/, replacement: editorCorePm }, ...copiedFrontAliases],
    dedupe: ["dexie", "fake-indexeddb"],
  },
  test: { environment: "node" },
});
