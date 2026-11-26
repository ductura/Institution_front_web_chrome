import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

it("WEB-V22-UVOZ-EKRAN: no network calls outside the shared client, no forms, no unchecked casts, no parameter named api", () => {
  const files = readdirSync(import.meta.dirname).filter((file) => /\.(tsx?|css)$/.test(file) && !/\.test\.tsx?$/.test(file));
  expect(files).toContain("IsvuPage.tsx");
  expect(files).toContain("reads.ts");
  for (const file of files) {
    const source = readFileSync(join(import.meta.dirname, file), "utf8");
    expect(source, file).not.toMatch(/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|axios)\b|\/api\/v\d|<form\b|as unknown as|\(api\s*[:,)]/);
  }
});
