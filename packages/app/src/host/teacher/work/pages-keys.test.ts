import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Rad uživo (LiveWork) drži komentare, banku i promjene kao braću u istom fragmentu: ključ koji ih
// ponovno postavlja pri promjeni rada mora biti različit za svakoga, inače React javlja dvostruki ključ.
describe("LiveWork keys", () => {
  it("no two elements in LiveWork share a key expression", () => {
    const source = readFileSync(join(import.meta.dirname, "pages.tsx"), "utf8");
    const start = source.indexOf("function LiveWork(");
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf("\nfunction ", start + 1);
    const body = source.slice(start, end === -1 ? undefined : end);
    const keys = [...body.matchAll(/\bkey=\{([^}]+)\}/g)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThanOrEqual(2);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
