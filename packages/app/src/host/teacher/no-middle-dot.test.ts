import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// "Papir i grafit": parts of a line are joined with a comma, never with "·" (S-07, design alignment 27. 11. 2026.).
// work/review/forbidden.ts uses "·" only as a hidden placeholder for the term scanner; it is never shown.
const ALLOWED = new Set(["work/review/forbidden.ts"]);
const root = fileURLToPath(new URL(".", import.meta.url));

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("teacher screens show no middle dot", () => {
  it("no source line outside comments builds text with '·'", () => {
    const files = sources(root);
    expect(files.length).toBeGreaterThan(100);
    const hits = files.flatMap((file) => {
      const name = relative(root, file).replaceAll("\\", "/");
      if (ALLOWED.has(name)) return [];
      return readFileSync(file, "utf8").split("\n")
        .map((line, i) => ({ line, at: `${name}:${i + 1}` }))
        .filter(({ line }) => line.includes("·") && !/^\s*(\/\/|\/?\*)/.test(line))
        .map(({ at }) => at);
    });
    expect(hits).toEqual([]);
  });
});
