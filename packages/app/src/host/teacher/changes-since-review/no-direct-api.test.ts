import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// WEB-1704: the changes card reaches the server only through src/client (port.ts), never through a
// network primitive or an API URL of its own.
const FORBIDDEN = /\bfetch\s*\(|XMLHttpRequest|\bWebSocket\b|\bEventSource\b|sendBeacon|\baxios\b|["'`]\/?api\/|<form\b/;

describe("no direct API in the changes-since-review module", () => {
  const files = readdirSync(import.meta.dirname).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));

  it("source files hold no network primitive and no API URL", () => {
    expect(files.length).toBeGreaterThanOrEqual(5);
    for (const file of files) expect({ file, hit: FORBIDDEN.test(readFileSync(join(import.meta.dirname, file), "utf8")) }).toEqual({ file, hit: false });
  });

  it("only the port imports the client, and only src/client/api", () => {
    for (const file of files) {
      const imports = [...readFileSync(join(import.meta.dirname, file), "utf8").matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1] ?? "");
      const client = imports.filter((path) => path.includes("src/client"));
      expect({ file, client }).toEqual({ file, client: file === "port.ts" ? ["../../../../../../src/client/api.ts"] : [] });
    }
  });
});
