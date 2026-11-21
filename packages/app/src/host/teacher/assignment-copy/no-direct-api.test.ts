import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const FORBIDDEN = /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|axios)\b|["'`]\/?api\/|<form\b/;

it("WEB-1904 reads and writes through the shared client, without API URLs or browser transports", () => {
  const files = readdirSync(import.meta.dirname).filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file));
  expect(files).toEqual(expect.arrayContaining(["AssignmentCopy.tsx", "client.ts"]));
  for (const file of files) {
    expect(readFileSync(join(import.meta.dirname, file), "utf8"), file).not.toMatch(FORBIDDEN);
  }
});
