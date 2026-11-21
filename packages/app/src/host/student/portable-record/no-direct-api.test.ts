import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// WEB-1304: the portable record reaches the server only through src/client/portable-record.ts,
// never through a network primitive or an API URL of its own.
const FORBIDDEN = /\bfetch\s*\(|XMLHttpRequest|\bWebSocket\b|\bEventSource\b|sendBeacon|\baxios\b|["'`]\/?api\/|<form\b/;
const DIRS = [import.meta.dirname, join(import.meta.dirname, "../../../../../ui/src/components/portable-record")];

describe("no direct API in WEB-1304 modules", () => {
  it("source files hold no network primitive and no API URL", () => {
    const files = DIRS.flatMap((dir) => readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f)).map((f) => join(dir, f)));
    expect(files.length).toBeGreaterThanOrEqual(5);
    for (const file of files) expect({ file, hit: FORBIDDEN.test(readFileSync(file, "utf8")) }).toEqual({ file, hit: false });
  });
});
