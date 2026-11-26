import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { resolve } from "../../../routes";

// WEB-V19-RECENZIJA-NASTAVNIK: the screen is reachable: the task's card in N-01 links to a path the route table
// resolves for a teacher (and only for a teacher), and the Next page of that path mounts the page.
describe("the teacher's peer-review page is mounted", () => {
  it("each task of N-01 links to /nastavnik/zadatak/<id>/recenzija", () => {
    const source = readFileSync(join(import.meta.dirname, "../assignment-facts/AssignmentFacts.tsx"), "utf8");
    expect(source).toContain("/recenzija`");
    expect(source).toContain("peer-review-link");
  });
  it("the route table opens it for a teacher only", () => {
    expect(resolve("/nastavnik/zadatak/a1/recenzija", "teacher")).toMatchObject({ kind: "page" });
    expect(resolve("/nastavnik/zadatak/a1/recenzija", "student")).not.toMatchObject({ kind: "page" });
    expect(resolve("/nastavnik/zadatak/a1/recenzija", null)).not.toMatchObject({ kind: "page" });
  });
  it("the Next page renders OverviewPage, which mounts both panels, and refuses a malformed id as not found", () => {
    const page = readFileSync(join(import.meta.dirname, "../../../../app/[base]/nastavnik/zadatak/[assignmentId]/recenzija/page.tsx"), "utf8");
    expect(page).toContain("OverviewPage");
    expect(page).toContain("notFound()");
    const overview = readFileSync(join(import.meta.dirname, "OverviewPage.tsx"), "utf8");
    expect(overview).toContain("<RoundPanel");
    expect(overview).toContain("<OverviewPanel");
  });
});
