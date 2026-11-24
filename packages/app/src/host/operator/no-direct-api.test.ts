import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../scripts/forbidden-terms/terms.ts";
import { actionLogMessages } from "./action-log/messages.hr";
import { problemReportsMessages } from "./problem-reports/messages.hr";

const DIRS = ["action-log", "problem-reports"].map((dir) => join(import.meta.dirname, dir));

it("NF-7 OA-3, OA-7: the pages reach the server only through the shared client, in read.ts, and send no form of their own", () => {
  for (const dir of DIRS) {
    const files = readdirSync(dir).filter((file) => /\.tsx?$/.test(file) && !file.endsWith(".test.ts"));
    expect(files.length).toBeGreaterThanOrEqual(2);
    expect(files).toContain("read.ts");
    for (const file of files) {
      const source = readFileSync(join(dir, file), "utf8");
      expect(source, file).not.toMatch(/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|axios)\b|\/api\/v\d|<form\b/);
      // Only read.ts builds the client; the page components go through it.
      if (file !== "read.ts") expect(source, file).not.toMatch(/\bcreateApi\b/);
    }
  }
});

it("NF-7 OA-3, OA-7: the interface text holds no forbidden term and names no provider", () => {
  const text = JSON.stringify([actionLogMessages, problemReportsMessages]);
  expect(findForbiddenTerms(text, "hr")).toEqual([]);
  expect(text).not.toMatch(/\bAI\b|model|OpenAI|Anthropic|Claude|GPT/i);
});
