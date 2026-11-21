import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// WEB-1402: "Započni rad" reaches the server only through src/client, never through a
// network primitive of its own, and names no API URL.
const FORBIDDEN = /\bfetch\s*\(|XMLHttpRequest|\bWebSocket\b|\bEventSource\b|sendBeacon|\baxios\b|["'`]\/?api\/|<form\b[^>]*\baction\s*=/;
const DIR = import.meta.dirname;

describe("no direct API in WEB-1402 modules", () => {
  it("source files hold no network primitive and no API URL", () => {
    const files = readdirSync(DIR).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f)).map((f) => join(DIR, f));
    expect(files.length).toBeGreaterThanOrEqual(3);
    for (const file of files) expect({ file, hit: FORBIDDEN.test(readFileSync(file, "utf8")) }).toEqual({ file, hit: false });
  });

  it("the page's transport is the client's start route, not one of its own", () => {
    const source = readFileSync(join(DIR, "StartWork.tsx"), "utf8");
    expect(source).toMatch(/from "\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/src\/client\/student-work"/);
    expect(source).toMatch(/startWorkCall\(\)/);
  });
});
