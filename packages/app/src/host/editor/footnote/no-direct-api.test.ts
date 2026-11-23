// PIL-K-FUSNOTA-VEZ: the footnote dialogs call no API; any later call goes through src/client
// (src/client/no-direct-api.test.ts scans the whole repo, this guards the folder).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const NETWORK = /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|["'`]\/api\/|from\s+["'][^"']*src\/client/u;

describe("no direct API in footnote/", () => {
  it("has no network primitive or API path in its source", () => {
    const files = readdirSync(import.meta.dirname).filter((f) => /\.tsx?$/u.test(f) && !/\.test\.tsx?$/u.test(f));
    expect(files.length).toBeGreaterThan(2);
    expect(files.filter((file) => NETWORK.test(readFileSync(join(import.meta.dirname, file), "utf8")))).toEqual([]);
  });
});
