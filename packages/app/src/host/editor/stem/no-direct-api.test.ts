import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// WEB-2134: the quote check and the LaTeX export run on the device; no network primitive, no API URL.
const FORBIDDEN = /\bfetch\s*\(|XMLHttpRequest|\bWebSocket\b|\bEventSource\b|sendBeacon|\baxios\b|["'`]\/?api\/|<form\b[^>]*\baction\s*=/;

describe("no direct API in the stem module", () => {
  it("source files hold no network primitive and no API URL", () => {
    const files = readdirSync(import.meta.dirname).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
    expect(files.length).toBeGreaterThan(4);
    for (const f of files) expect({ f, hit: FORBIDDEN.test(readFileSync(join(import.meta.dirname, f), "utf8")) }).toEqual({ f, hit: false });
  });
});
