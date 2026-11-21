import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

it("WEB-1906 nema mrežnih poziva izvan zajedničkog klijenta", () => {
  const files = readdirSync(import.meta.dirname).filter((file) => /\.(tsx?|css)$/.test(file) && !file.endsWith(".test.ts"));
  expect(files).toContain("PilotMetrics.tsx");
  expect(files).toContain("read.ts");
  for (const file of files) {
    expect(readFileSync(join(import.meta.dirname, file), "utf8"), file).not.toMatch(
      /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|axios)\b|\/api\/v\d|<form\b/,
    );
  }
});
