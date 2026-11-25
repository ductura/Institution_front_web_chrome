import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

it("WEB-V15-KLIJENT nema mrežnih poziva izvan zajedničkog klijenta", () => {
  const files = readdirSync(import.meta.dirname).filter((file) => /\.tsx?$/.test(file) && !file.endsWith(".test.ts"));
  expect(files).toEqual(expect.arrayContaining(["read.ts", "run.ts", "limits.ts"]));
  for (const file of files) {
    const source = readFileSync(join(import.meta.dirname, file), "utf8");
    expect(source, file).not.toMatch(/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|axios)\b|\/api\/v\d|<form\b/);
    expect(source, file).not.toMatch(/as unknown as/);
  }
});
