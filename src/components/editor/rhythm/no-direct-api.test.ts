import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// PIL-P1-RITAM-PREKIDAC: the rhythm setting and the dialog reach the server only through
// src/client/input-rhythm.ts (createApi and the contract), never through a primitive of their own.
const FORBIDDEN = /\bfetch\s*\(|XMLHttpRequest|\bWebSocket\b|\bEventSource\b|sendBeacon|\baxios\b|["'`]\/?api\/|<form\b/;
const FOLDERS = [import.meta.dirname, join(import.meta.dirname, "../help/what-is-recorded")];

describe("no direct API in the rhythm setting", () => {
  it("source files hold no network primitive and no API URL", () => {
    const files = FOLDERS.flatMap((dir) => readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f)).map((f) => join(dir, f)));
    expect(files.length).toBeGreaterThanOrEqual(5);
    for (const file of files) expect({ file, hit: FORBIDDEN.test(readFileSync(file, "utf8")) }).toEqual({ file, hit: false });
  });

  it("negative control: the same check catches a direct call", () => {
    expect(FORBIDDEN.test('await fetch("/api/v1/works/x/input-rhythm", { method: "DELETE" })')).toBe(true);
    expect(FORBIDDEN.test("const url = `/api/v1/works`;")).toBe(true);
  });
});
