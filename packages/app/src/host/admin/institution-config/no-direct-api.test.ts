import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

it("keeps the institution rules page on the shared client", () => {
  const sources = readdirSync(import.meta.dirname).filter((name) => /(?<!\.test)\.tsx?$/.test(name));
  expect(sources).toContain("InstitutionConfig.tsx");
  expect(sources).toContain("client.ts");
  const route = new URL("../../../../app/[base]/ustanova/pravila/page.tsx", import.meta.url);
  const files = [...sources.map((name) => join(import.meta.dirname, name)), route];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    expect(source, String(file)).not.toMatch(/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|browserTransport|sendBeacon|axios|formAction|withActor)\b|\/api\/v\d|<form[^>]*\saction=/);
  }
  expect(readFileSync(join(import.meta.dirname, "client.ts"), "utf8")).toContain('from "@/client/api"');
});
