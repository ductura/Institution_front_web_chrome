import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

// DEMO-POP-1: a mentored work (a thesis) has no course, so student.assignments.get alone never names it and
// editorWorkRead answered "not found": the receipt of a submitted thesis showed "Stranica ne postoji".
// Every host page that finds the student's work by id reads through withMentoredAssignments, as work.tsx does.
const pages = ["work.tsx", "submission/index.tsx", "other/index.tsx"];

it.each(pages)("DEMO-POP-1: %s finds a mentored work by id", (page) => {
  const source = readFileSync(join(import.meta.dirname, page), "utf8");
  expect(source).toContain("editorWorkRead(");
  expect(source).toMatch(/withMentoredAssignments\(createApi\(\)\)/);
  expect(source).not.toMatch(/const client = createApi\(\);/);
});
