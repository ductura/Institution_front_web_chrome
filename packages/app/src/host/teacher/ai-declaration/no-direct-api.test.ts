import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// PIL-K-AI-PRILOZI: the N-07 declaration reaches the server only through src/client, never through
// a network primitive of its own; the removed WEB-1209 twin panel is imported from nowhere.
const FORBIDDEN = /\bfetch\s*\(|XMLHttpRequest|\bWebSocket\b|\bEventSource\b|sendBeacon|\baxios\b|["'`]\/?api\/|<form\b/;
const REPO = join(import.meta.dirname, "../../../../../..");

function sources(dir: string, found: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sources(path, found);
    else if (/\.(?:ts|tsx|mts)$/.test(name)) found.push(path);
  }
  return found;
}

describe("no direct API in the PIL-K-AI-PRILOZI module", () => {
  it("source files hold no network primitive and no API URL", () => {
    const files = readdirSync(import.meta.dirname).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
    expect(files.length).toBeGreaterThanOrEqual(3);
    for (const file of files) expect({ file, hit: FORBIDDEN.test(readFileSync(join(import.meta.dirname, file), "utf8")) }).toEqual({ file, hit: false });
  });

  it("no source imports the removed TeacherAiAttachmentsPanel", () => {
    const hits = ["packages", "src", "catalog"]
      .flatMap((top) => sources(join(REPO, top)))
      .filter((path) => path !== import.meta.filename)
      .filter((path) => /["'][^"'\n]*TeacherAiAttachmentsPanel(?:\.tsx)?["']/.test(readFileSync(path, "utf8")))
      .map((path) => relative(REPO, path));
    expect(hits).toEqual([]);
  });
});
