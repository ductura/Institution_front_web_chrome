import { readdirSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("leaves source notebook requests to the shared client", () => {
  const files = readdirSync(import.meta.dirname).filter((name) => /\.tsx?$/.test(name) && !name.endsWith(".test.ts"));
  expect(files).toContain("SourceNotebookHost.tsx");
  expect(files).toContain("notebook.ts");
  for (const file of files) {
    const code = readFileSync(new URL(file, import.meta.url), "utf8");
    expect(code, file).not.toMatch(/\b(?:fetch|browserTransport|createApi|XMLHttpRequest|WebSocket|EventSource|sendBeacon|axios)\b|\/api\/v\d|\bformAction\b/);
  }
});
