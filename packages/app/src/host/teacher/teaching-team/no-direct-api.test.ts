import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const DIR = import.meta.dirname;
const CLIENT = join(DIR, "../../../../../../src/client/teaching-team.ts");

it("WEB-1405 uses the shared API client and the shared data table", () => {
  const files = readdirSync(DIR).filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file));
  const forbidden = /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|axios)\b|["'`]\/?api\/|<form\b/;
  for (const path of [...files.map((file) => join(DIR, file)), CLIENT]) {
    expect(readFileSync(path, "utf8"), path).not.toMatch(forbidden);
  }
  expect(readFileSync(CLIENT, "utf8")).toContain("api = createApi()");
  const screen = readFileSync(join(DIR, "TeachingTeam.tsx"), "utf8");
  expect(screen).toMatch(/import \{[^}]*\bDataTable\b[^}]*\} from "@ductura\/ui"/);
  expect(screen).toContain("<DataTable");
  expect(screen).not.toMatch(/<table\b/);
});
