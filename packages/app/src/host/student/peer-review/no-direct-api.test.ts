import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// WEB-V19-RECENZIJA-STUDENT: the peer-review screens reach the server only through src/client, never through a
// network primitive of its own, and never past the generated types (no `as unknown as`).
const FORBIDDEN = /\bfetch\s*\(|XMLHttpRequest|\bWebSocket\b|\bEventSource\b|sendBeacon|\baxios\b|["'`]\/?api\/|<form\b[^>]*\baction\s*=|as unknown as/;

describe("no direct API in the peer-review screens", () => {
  it("source files hold no network primitive, no API URL and no cast past the contract types", () => {
    const dir = import.meta.dirname;
    const files = readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f)).map((f) => join(dir, f));
    expect(files.length).toBeGreaterThanOrEqual(6);
    for (const file of files) expect({ file, hit: FORBIDDEN.test(readFileSync(file, "utf8")) }).toEqual({ file, hit: false });
  });
});
