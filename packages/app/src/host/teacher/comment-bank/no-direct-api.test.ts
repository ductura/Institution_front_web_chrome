import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// WEB-1704: the comment bank and the changes view reach the server only through their ports
// (src/client), never through a network primitive of their own.
const FORBIDDEN = /\bfetch\s*\(|XMLHttpRequest|\bWebSocket\b|\bEventSource\b|sendBeacon|\baxios\b|["'`]\/?api\/|<form\b/;
const DIRS = [join(import.meta.dirname, ".."), ].flatMap((root) => ["comment-bank", "changes-since-review"].map((d) => join(root, d)));

describe("no direct API in WEB-1704 modules", () => {
  it("source files hold no network primitive and no API URL", () => {
    const files = DIRS.flatMap((dir) => readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f)).map((f) => join(dir, f)));
    expect(files.length).toBeGreaterThan(6);
    for (const file of files) expect({ file, hit: FORBIDDEN.test(readFileSync(file, "utf8")) }).toEqual({ file, hit: false });
  });
});
