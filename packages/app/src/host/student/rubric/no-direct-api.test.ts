import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// WEB-V17-RUBRIC-STUDENT: the card reaches the server only through src/client, never past the generated types.
const FORBIDDEN = /\bfetch\s*\(|XMLHttpRequest|\bWebSocket\b|\bEventSource\b|sendBeacon|\baxios\b|["'`]\/?api\/|as unknown as/;

describe("no direct API in the rubric card", () => {
  it("source files hold no network primitive, no API URL and no cast past the contract types", () => {
    const dir = import.meta.dirname;
    const files = readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f)).map((f) => join(dir, f));
    expect(files.length).toBeGreaterThanOrEqual(3);
    for (const file of files) expect({ file, hit: FORBIDDEN.test(readFileSync(file, "utf8")) }).toEqual({ file, hit: false });
  });
});
