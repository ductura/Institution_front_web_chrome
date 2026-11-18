import { fileURLToPath } from "node:url";

// Runtime twin of the "paths" in tsconfig.json: the code copied from Ductus
// 0cdb0f1f imports through "@/"; editor and domain paths now live in
// @ductura/editor-core. Forward slashes keep the aliases working on Windows.
const at = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url)).replaceAll("\\", "/");
const core = at("../../packages/editor-core/src/");
const src = at("../");

export const copiedFrontAliases = [
  { find: /^@\/editor(?=\/|$)/, replacement: `${core}editor` },
  { find: /^@\/domain\/json$/, replacement: `${core}document/json` },
  { find: /^@\/domain\/(document|citation|collaboration|diff|text|forensics)(?=\/|$)/, replacement: `${core}document/$1` },
  { find: /^@\/domain\/sync(?=\/|$)/, replacement: `${core}sync` },
  { find: /^@\/domain\/serverSync(?=\/|$)/, replacement: `${core}serverSync` },
  { find: /^@\/lib\/journal(?=\/|$)/, replacement: `${core}journal` },
  { find: /^@\/lib\/sync(?=\/|$)/, replacement: `${core}sync/runner` },
  { find: /^@\//, replacement: src.endsWith("/") ? src : `${src}/` },
];
