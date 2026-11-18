import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/** Git's blob id of a file: sha1("blob <bytes>\0" + content). */
function gitBlobSha(content: Buffer): string {
  return createHash("sha1").update(`blob ${content.length}\0`).update(content).digest("hex");
}

const here = (path: string) => new URL(`../${path}`, import.meta.url);
const MANIFEST = readFileSync(here("PROVENANCE.md"), "utf8");
const SOURCE_COMMIT = "ce908f7a652bfc810a8c266346cd574b8d395da6";

type Row = { path: string; sha1: string; sha256: string; changed: boolean };
const ROWS: Row[] = MANIFEST.split("\n")
  .map((line) => line.match(/^\| `([^`]+)` \| `([0-9a-f]{40})` \| `([0-9a-f]{64})` \| (da|ne) \|$/))
  .filter((m): m is RegExpMatchArray => m !== null)
  .map(([, path, sha1, sha256, changed]) => ({ path: path!, sha1: sha1!, sha256: sha256!, changed: changed === "da" }));

/** Ported files: everything under src/domain (the part of the Ductus tree ported so far). */
function portedFiles(dir = "src/domain"): string[] {
  return readdirSync(here(dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? portedFiles(`${dir}/${e.name}`) : [`${dir}/${e.name}`.slice("src/".length)],
  );
}

/** The one edit made at the port, undone, to get the source back. */
const UNDO_IMPORT: Record<string, [string, string]> = {
  "domain/document/snapshot.ts": ['"../forensics/jcs"', '"@/domain/forensics/jcs"'],
};

describe("code ported from Ductus at a recorded commit (PROVENANCE.md)", () => {
  it("names the source commit and a fixed number of ported files", () => {
    expect(MANIFEST).toMatch(new RegExp(`^\`${SOURCE_COMMIT}\` `, "m"));
    expect(ROWS).toHaveLength(20);
    expect(ROWS.filter((r) => r.changed).map((r) => r.path)).toEqual(["domain/document/snapshot.ts"]);
  });

  it("lists every file under src/domain and no file that is missing", () => {
    expect(ROWS.map((r) => r.path).sort()).toEqual(portedFiles().sort());
  });

  for (const row of ROWS) {
    it(`${row.path} is the source${row.changed ? " with only the recorded import changed" : " byte for byte"}`, () => {
      const bytes = readFileSync(here(`src/${row.path}`));
      expect(bytes.includes(13)).toBe(false); // LF only; a CR would change the blob id
      if (!row.changed) {
        expect(gitBlobSha(bytes)).toBe(row.sha1);
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(row.sha256);
        return;
      }
      const [now, before] = UNDO_IMPORT[row.path]!;
      const text = bytes.toString("utf8");
      expect(text.split(now)).toHaveLength(2); // the edit is exactly one occurrence
      const source = Buffer.from(text.replace(now, before), "utf8");
      expect(gitBlobSha(source)).toBe(row.sha1);
      expect(createHash("sha256").update(source).digest("hex")).toBe(row.sha256);
      expect(gitBlobSha(bytes)).not.toBe(row.sha1);
    });
  }

  it("computes the Git blob id like git does", () => {
    expect(gitBlobSha(Buffer.alloc(0))).toBe("e69de29bb2d1d6434b8b29ae775ad8c2e48c5391");
    expect(gitBlobSha(Buffer.from("hello\n"))).toBe("ce013625030ba8dba906f756967f9e9ca394464a");
    expect(gitBlobSha(Buffer.from("hello\r\n"))).not.toBe(gitBlobSha(Buffer.from("hello\n")));
  });
});
