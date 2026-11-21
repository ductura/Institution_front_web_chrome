import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// WEB-1502: the submissions screen reaches the server only through its port, and its client module
// only through the transport it is given; neither holds a network primitive or an API URL.
const FORBIDDEN = /\bfetch\s*\(|XMLHttpRequest|\bWebSocket\b|\bEventSource\b|sendBeacon|\baxios\b|["'`]\/?api\/|<form\b/;
const DIR = import.meta.dirname;
const CLIENT = join(DIR, "../../../../../../src/client/teacher-submissions.ts");
const SCREEN = join(DIR, "TeacherSubmissions.tsx");

describe("no direct API in WEB-1502 modules", () => {
  it("source files hold no network primitive and no API URL", () => {
    const files = [...readdirSync(DIR).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f)).map((f) => join(DIR, f)), CLIENT];
    expect(files.length).toBeGreaterThan(4);
    for (const file of files) expect({ file, hit: FORBIDDEN.test(readFileSync(file, "utf8")) }).toEqual({ file, hit: false });
  });

  it("the table is the DataTable of @ductura/ui, not a table of its own", () => {
    const source = readFileSync(SCREEN, "utf8");
    expect(source).toMatch(/import \{[^}]*\bDataTable\b[^}]*\} from "@ductura\/ui"/);
    expect(source).toContain("<DataTable");
    expect(source).not.toMatch(/<table\b/);
  });
});
