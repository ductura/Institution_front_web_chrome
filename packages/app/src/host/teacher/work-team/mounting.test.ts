import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { resolve } from "../../../routes";

// WEB-V19-GRUPA: the screen is reachable: the task's card in N-01 links to a path the route table resolves
// for a teacher (and only for a teacher), and the Next page of that path mounts the teams page.
describe("the teacher's teams page is mounted", () => {
  it("each task of N-01 links to /nastavnik/zadatak/<id>/timovi", () => {
    const source = readFileSync(join(import.meta.dirname, "../assignment-facts/AssignmentFacts.tsx"), "utf8");
    expect(source).toContain("/timovi`");
    expect(source).toContain("work-teams-link");
  });
  it("the route table opens it for a teacher only", () => {
    expect(resolve("/nastavnik/zadatak/a1/timovi", "teacher")).toMatchObject({ kind: "page" });
    expect(resolve("/nastavnik/zadatak/a1/timovi", "student")).not.toMatchObject({ kind: "page" });
  });
  it("the Next page renders TeamsPage and refuses a malformed id as not found", () => {
    const page = readFileSync(join(import.meta.dirname, "../../../../app/(host)/nastavnik/zadatak/[assignmentId]/timovi/page.tsx"), "utf8");
    expect(page).toContain("TeamsPage");
    expect(page).toContain("notFound()");
  });
});
