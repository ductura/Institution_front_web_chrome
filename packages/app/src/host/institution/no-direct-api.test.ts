import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// LOK-WEB-8: the institution screens reach the server only through createApi (reads.ts), never
// through a network primitive or an API URL of their own.
const NETWORK = /\bfetch\s*\(|XMLHttpRequest|\bWebSocket\b|\bEventSource\b|sendBeacon|\baxios\b|["'`]\/?api\//;
const sources = readdirSync(import.meta.dirname)
  .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
  .map((f) => join(import.meta.dirname, f));

describe("no direct API in the institution screens", () => {
  it("source files hold no network primitive and no API URL", () => {
    expect(sources.length).toBeGreaterThanOrEqual(4);
    for (const file of sources) expect({ file, hit: NETWORK.test(readFileSync(file, "utf8")) }).toEqual({ file, hit: false });
  });
});
