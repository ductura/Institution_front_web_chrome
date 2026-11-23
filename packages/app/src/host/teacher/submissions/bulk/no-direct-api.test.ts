import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// WEB-1902: the bulk download reaches the server only through the transport it is given; no source
// file holds a network primitive, a form or an API URL.
const FORBIDDEN = /\bfetch\s*\(|XMLHttpRequest|\bWebSocket\b|\bEventSource\b|sendBeacon|\baxios\b|["'`]\/?api\/|<form\b/;
const DIR = import.meta.dirname;

describe("no direct API in WEB-1902 modules", () => {
  it("source files hold no network primitive and no API URL", () => {
    const files = readdirSync(DIR).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f)).map((f) => join(DIR, f));
    expect(files.length).toBeGreaterThanOrEqual(5);
    for (const file of files) expect({ file, hit: FORBIDDEN.test(readFileSync(file, "utf8")) }).toEqual({ file, hit: false });
  });

  it("PIL-D2-ZIP: the file path is the contract's, and the screen asks only through its port", () => {
    expect(readFileSync(join(DIR, "contract.ts"), "utf8")).not.toMatch(/submissions-bulk\//);
    expect(readFileSync(join(DIR, "contract.ts"), "utf8")).toContain('migrationContracts["teacher.submissions-bulk.get"]');
    const screen = readFileSync(join(DIR, "BulkDownload.tsx"), "utf8");
    expect(screen).toMatch(/bulkPort\(call/);
    expect(screen).not.toMatch(/requestBulkLink|createApi/);
  });

  it("the screen uses the Button of @ductura/ui", () => {
    expect(readFileSync(join(DIR, "BulkDownload.tsx"), "utf8")).toMatch(/import \{[^}]*\bButton\b[^}]*\} from "@ductura\/ui"/);
  });
});
