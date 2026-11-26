import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

// DEMO-POP-2: the panels below the work are siblings in one fragment; a shared key made React warn
// "two children with the same key" and could drop or repeat a panel when the work changes.
it("DEMO-POP-2: sibling panels of the teacher work page have distinct keys", () => {
  const source = readFileSync(join(import.meta.dirname, "pages.tsx"), "utf8");
  const start = source.indexOf("{!stopped && <>");
  expect(start).toBeGreaterThan(-1);
  const block = source.slice(start, source.indexOf("</>}", start));
  const keys = [...block.matchAll(/\bkey=\{(`[^`]*`|[^}]*)\}/g)].map((m) => m[1]);
  expect(keys.length).toBeGreaterThanOrEqual(3);
  expect(new Set(keys).size).toBe(keys.length);
});
