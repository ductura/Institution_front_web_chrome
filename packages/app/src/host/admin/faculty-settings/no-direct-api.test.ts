import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

it("NF-7 OA-2/OA-9: nema mrežnih poziva izvan zajedničkog klijenta, nema obrazaca ni zapisivanja", () => {
  const files = readdirSync(import.meta.dirname).filter((file) => /\.(tsx?|css)$/.test(file) && !/\.test\.tsx?$/.test(file));
  expect(files).toContain("FacultySettingsPage.tsx");
  for (const file of files) {
    expect(readFileSync(join(import.meta.dirname, file), "utf8"), file).not.toMatch(
      /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|axios)\b|\/api\/v\d|<form\b|\.post"|\.put"|\.delete"/,
    );
  }
});
