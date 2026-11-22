import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

it("N-01 card reaches the server only through the shared API client", () => {
  const forbidden = /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|axios)\b|["'`]\/?api\/|<form\b/;
  const files = readdirSync(import.meta.dirname).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
  for (const file of files) expect(readFileSync(join(import.meta.dirname, file), "utf8"), file).not.toMatch(forbidden);
});
