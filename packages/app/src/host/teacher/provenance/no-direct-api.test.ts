import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// WEB-2158 and PIL-P1-PODUDARANJE-KARTA: the provenance map and its assistant match section reach the server
// only through their ports (src/client), never through a network primitive of their own.
const FORBIDDEN = /\bfetch\s*\(|XMLHttpRequest|\bWebSocket\b|\bEventSource\b|sendBeacon|\baxios\b|["'`]\/?api\/|<form\b/;

describe("no direct API in WEB-2158 module", () => {
  it("source files hold no network primitive and no API URL", () => {
    const files = readdirSync(import.meta.dirname).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
    expect(files.length).toBeGreaterThanOrEqual(12);
    for (const file of files) expect({ file, hit: FORBIDDEN.test(readFileSync(join(import.meta.dirname, file), "utf8")) }).toEqual({ file, hit: false });
  });
});
