// PIL-D8-PRECACI: the shortcut list and the shell bar call no API; any later call goes through
// src/client (src/client/no-direct-api.test.ts scans the whole repo, this guards the folders).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DIRS = [import.meta.dirname, join(import.meta.dirname, "../shell")];
const NETWORK = /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|["'`]\/api\/|from\s+["'][^"']*src\/client/u;

describe("no direct API in shortcuts/ and shell/", () => {
  it("has no network primitive or API path in its source", () => {
    const files = DIRS.flatMap((dir) => readdirSync(dir).filter((f) => /\.tsx?$/u.test(f) && !/\.test\.tsx?$/u.test(f)).map((f) => join(dir, f)));
    expect(files.length).toBeGreaterThan(3);
    expect(files.filter((file) => NETWORK.test(readFileSync(file, "utf8")))).toEqual([]);
  });
});
