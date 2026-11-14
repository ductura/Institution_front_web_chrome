import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/** Git's blob id of a file: sha1("blob <bytes>\0" + content). */
function gitBlobSha(content: Buffer): string {
  return createHash("sha1").update(`blob ${content.length}\0`).update(content).digest("hex");
}

const here = (path: string) => new URL(`../${path}`, import.meta.url);
const MANIFEST = readFileSync(here("PROVENANCE.md"), "utf8");
/** Rows of the first table only: the files ported byte for byte. */
const EXACT = MANIFEST.split("## Prilagođeno")[0]!
  .split("\n")
  .map((line) => line.match(/^\| `([^`]+)` \| `[^`]+` \| `([0-9a-f]{40})` \|$/))
  .filter((m): m is RegExpMatchArray => m !== null)
  .map(([, path, sha]) => [path!, sha!] as const);

describe("tokens ported from Ductus at a recorded commit (PROVENANCE.md)", () => {
  it("names the source commit and every ported file", () => {
    expect(MANIFEST).toContain("d52a92c3a108f3f0ec9c3639188a2ea669bba582");
    expect(EXACT.map(([path]) => path)).toEqual(expect.arrayContaining([
      "src/tokens/globals.css", "src/fonts/fonts.css", "src/theme/theme.ts",
    ]));
    expect(EXACT).toHaveLength(13);
  });

  for (const [path, sha] of EXACT) {
    it(`${path} is byte for byte the source`, () => {
      expect(gitBlobSha(readFileSync(here(path)))).toBe(sha);
    });
  }

  it("notices a single changed byte", () => {
    const css = readFileSync(here("src/tokens/globals.css"));
    const changed = Buffer.from(css);
    const at = changed.length - 2;
    changed[at] = changed[at]! ^ 1;
    expect(gitBlobSha(changed)).not.toBe(gitBlobSha(css));
    expect(gitBlobSha(Buffer.from("hello\n"))).toBe("ce013625030ba8dba906f756967f9e9ca394464a");
  });
});
