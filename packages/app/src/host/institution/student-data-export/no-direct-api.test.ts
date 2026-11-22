import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// WEB-1302: the export pages reach the server only through src/client/student-data-export.ts,
// never through a network primitive or an API URL of their own. The ui components hold forms of
// their own, so only the host files are held to "no <form>".
const NETWORK = /\bfetch\s*\(|XMLHttpRequest|\bWebSocket\b|\bEventSource\b|sendBeacon|\baxios\b|["'`]\/?api\//;
const FORM = /<form\b/;
const HOST = [import.meta.dirname, join(import.meta.dirname, "../../public/student-data-download")];
const UI = [join(import.meta.dirname, "../../../../../ui/src/components/student-data-export")];
const sources = (dirs: string[]) =>
  dirs.flatMap((dir) => readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f)).map((f) => join(dir, f)));

describe("no direct API in WEB-1302 modules", () => {
  it("source files hold no network primitive and no API URL", () => {
    const files = [...sources(HOST), ...sources(UI)];
    expect(files.length).toBeGreaterThanOrEqual(5);
    for (const file of files) expect({ file, hit: NETWORK.test(readFileSync(file, "utf8")) }).toEqual({ file, hit: false });
  });

  it("the host files send no form of their own", () => {
    for (const file of sources(HOST)) expect({ file, hit: FORM.test(readFileSync(file, "utf8")) }).toEqual({ file, hit: false });
  });
});
