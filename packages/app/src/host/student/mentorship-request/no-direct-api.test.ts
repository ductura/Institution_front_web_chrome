import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// WEB-1404: the mentorship pages reach the server only through src/client, never through a
// network primitive of their own.
const FORBIDDEN = /\bfetch\s*\(|XMLHttpRequest|\bWebSocket\b|\bEventSource\b|sendBeacon|\baxios\b|["'`]\/?api\/|<form\b[^>]*\baction\s*=/;
const DIRS = [join(import.meta.dirname), join(import.meta.dirname, "../../teacher/mentorships")];

describe("no direct API in WEB-1404 modules", () => {
  it("source files hold no network primitive and no API URL", () => {
    const files = DIRS.flatMap((dir) => readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f)).map((f) => join(dir, f)));
    expect(files.length).toBeGreaterThan(6);
    for (const file of files) expect({ file, hit: FORBIDDEN.test(readFileSync(file, "utf8")) }).toEqual({ file, hit: false });
  });
});
