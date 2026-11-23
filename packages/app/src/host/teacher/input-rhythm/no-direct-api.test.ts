import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// PIL-P1-RITAM-NASTAVNIK: the rhythm switch reaches the server only through src/client
// (input-rhythm-teacher.ts and contract.ts), never through a network primitive of its own.
const FORBIDDEN = /\bfetch\s*\(|XMLHttpRequest|\bWebSocket\b|\bEventSource\b|sendBeacon|\baxios\b|["'`]\/?api\/|<form\b/;

describe("no direct API in the rhythm switch module", () => {
  it("source files hold no network primitive and no API URL", () => {
    const files = readdirSync(import.meta.dirname).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
    expect(files.length).toBeGreaterThanOrEqual(4);
    for (const file of files) expect({ file, hit: FORBIDDEN.test(readFileSync(join(import.meta.dirname, file), "utf8")) }).toEqual({ file, hit: false });
  });

  it("negative control: the same check catches a direct call", () => {
    expect(FORBIDDEN.test('await fetch("/api/v1/teacher/courses/x/input-rhythm")')).toBe(true);
    expect(FORBIDDEN.test("const url = `/api/v1/teacher`;")).toBe(true);
  });
});
