import { readdirSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";

const NETWORK = /\b(?:fetch|browserTransport|XMLHttpRequest|WebSocket|EventSource|sendBeacon|axios)\b|\/api\/v\d|\bformAction\b/;

it("reaches the server only through the generated client, and only the named operations", () => {
  const files = readdirSync(import.meta.dirname).filter((name) => /\.tsx?$/.test(name) && !name.endsWith(".test.ts"));
  expect(files).toContain("TeacherBibliographyHost.tsx");
  for (const file of files) {
    const code = readFileSync(new URL(file, import.meta.url), "utf8");
    expect(code, file).not.toMatch(NETWORK);
    if (file !== "literature-read.ts" && file !== "guidance.ts") expect(code, file).not.toMatch(/\bcreateApi\b/);
  }
  const guidance = readFileSync(new URL("guidance.ts", import.meta.url), "utf8");
  expect([...guidance.matchAll(/call\("([^"]+)"/g)].map((m) => m[1]).sort()).toEqual([
    "teacher.literature-seen.put", "teacher.source-guidance.get", "teacher.source-proof-request.delete", "teacher.source-proof-request.put",
    "teacher.source-proofs.get", "teacher.source-recommendation.delete", "teacher.source-recommendation.put",
  ]);
  const reader = readFileSync(new URL("literature-read.ts", import.meta.url), "utf8");
  expect([...reader.matchAll(/call\("([^"]+)"/g)].map((m) => m[1])).toEqual(["work.versions.get", "work.version.get"]);
});
