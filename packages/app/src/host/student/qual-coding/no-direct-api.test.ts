import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// WEB-V18-KODIRANJE-OZNAKE: the page reaches the server only through src/client, never through a network
// primitive of its own, never past the generated types (no `as unknown as`), and never to the assistant (V18-3).
const FORBIDDEN = /\bfetch\s*\(|XMLHttpRequest|\bWebSocket\b|\bEventSource\b|sendBeacon|\baxios\b|["'`]\/?api\/|<form\b[^>]*\baction\s*=|as unknown as|assistant|<audio|<video|type="file"/i;

describe("no direct API in the coding page", () => {
  it("source files hold no network primitive, no API URL, no cast past the contract types and no assistant call", () => {
    const dir = import.meta.dirname;
    const files = readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f)).map((f) => join(dir, f));
    expect(files.length).toBeGreaterThanOrEqual(3);
    for (const file of files) expect({ file, hit: FORBIDDEN.test(readFileSync(file, "utf8")) }).toEqual({ file, hit: false });
  });
});
