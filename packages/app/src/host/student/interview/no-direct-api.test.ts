import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// PIL-K-RAZGOVOR: the student's interview module reaches the server only through src/client.
const FORBIDDEN = /\bfetch\s*\(|XMLHttpRequest|\bWebSocket\b|\bEventSource\b|sendBeacon|\baxios\b|["'`]\/?api\/|<form\b/;

describe("no direct API in the student interview module", () => {
  it("source files hold no network primitive and no API URL", () => {
    const files = readdirSync(import.meta.dirname).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
    expect(files.length).toBeGreaterThanOrEqual(6);
    for (const file of files) expect({ file, hit: FORBIDDEN.test(readFileSync(join(import.meta.dirname, file), "utf8")) }).toEqual({ file, hit: false });
  });
});
