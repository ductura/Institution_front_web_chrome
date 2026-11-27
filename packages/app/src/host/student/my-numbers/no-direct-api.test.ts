import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// F4-PM2-R20: "Moj rad u brojkama" reaches the server only through src/client, never through a network
// primitive of its own, never past the generated types, and holds no timer, keystroke or comparison primitive (D-63).
const FORBIDDEN = /\bfetch\s*\(|XMLHttpRequest|\bWebSocket\b|\bEventSource\b|sendBeacon|\baxios\b|["'`]\/?api\/|<form\b[^>]*\baction\s*=|as unknown as|keydown|keyup|keypress|performance\.now/;

describe("no direct API in the work-in-numbers module", () => {
  it("source files hold no network primitive, no API URL, no cast past the contract types and no keystroke timing", () => {
    const dir = import.meta.dirname;
    const files = readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f)).map((f) => join(dir, f));
    expect(files.length).toBeGreaterThanOrEqual(4);
    for (const file of files) expect({ file, hit: FORBIDDEN.test(readFileSync(file, "utf8")) }).toEqual({ file, hit: false });
  });
  it("is mounted on the 'Moji radovi' page, not only in a test", () => {
    const page = readFileSync(join(import.meta.dirname, "../courses/WorksPage.tsx"), "utf8");
    expect(page).toMatch(/import MyNumbers from "\.\.\/my-numbers\/MyNumbers"/);
    expect(page).toMatch(/<MyNumbers here=/);
  });
});
