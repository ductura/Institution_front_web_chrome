import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// PIL-D7-POVIJEST: the version history reaches the server only through src/client/time-machine.ts
// (createApi and the generated contract), never through a network primitive or an API URL of its own.
const FORBIDDEN = /\bfetch\s*\(|XMLHttpRequest|\bWebSocket\b|\bEventSource\b|sendBeacon|\baxios\b|["'`]\/?api\/|<form\b/;

describe("no direct API in the time machine module", () => {
  it("source files hold no network primitive and no API URL", () => {
    const files = readdirSync(import.meta.dirname).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
    expect(files).toEqual(expect.arrayContaining(["client-port.ts", "VersionHistory.tsx", "model.ts"]));
    for (const file of files) expect({ file, hit: FORBIDDEN.test(readFileSync(join(import.meta.dirname, file), "utf8")) }).toEqual({ file, hit: false });
  });
  it("the real port imports only the time machine client and createApi", () => {
    const source = readFileSync(join(import.meta.dirname, "client-port.ts"), "utf8");
    const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    expect(imports.sort()).toEqual(["../../../../../../src/client/api.ts", "../../../../../../src/client/time-machine.ts", "./model"]);
  });
});
