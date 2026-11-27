import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { resolve } from "../../../routes";

// WEB-V21-KOD-TESTOVI-OBRAZAC: the screen is reachable by its own path: the route table resolves it for a teacher
// (and only for a teacher) and the Next page of that path mounts it. The link from the task's card is outside the lane.
describe("the teacher's code-test page is mounted", () => {
  it("the route table opens it for a teacher only", () => {
    expect(resolve("/nastavnik/zadatak/a1/testovi", "teacher")).toMatchObject({ kind: "page", page: { label: "Testovi uz zadatak" } });
    expect(resolve("/nastavnik/zadatak/a1/testovi", "student")).not.toMatchObject({ kind: "page" });
    expect(resolve("/nastavnik/zadatak/a1/testovi", null)).not.toMatchObject({ kind: "page" });
  });
  it("the Next page renders CodeTestsPage, which mounts the form, and refuses a malformed id as not found", () => {
    const page = readFileSync(join(import.meta.dirname, "../../../../app/(host)/nastavnik/zadatak/[assignmentId]/testovi/page.tsx"), "utf8");
    expect(page).toContain("CodeTestsPage");
    expect(page).toContain("notFound()");
    expect(readFileSync(join(import.meta.dirname, "CodeTestsPage.tsx"), "utf8")).toContain("<CodeTestsForm");
  });
  it("the task's card links to it and the page returns to the task", () => {
    const card = readFileSync(join(import.meta.dirname, "../assignment-facts/AssignmentFacts.tsx"), "utf8");
    expect(card).toContain("/testovi");
    expect(card).toContain("code-tests-link");
    expect(readFileSync(join(import.meta.dirname, "CodeTestsPage.tsx"), "utf8")).toContain("taskPath(assignmentId)");
  });
});
