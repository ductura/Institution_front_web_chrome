import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { resolve } from "../../../routes";

// WEB-V19-GRUPA: the screen is reachable: the notice of the assignment links to a path the route table
// resolves for a student (and only for a student), and the Next page of that path mounts the team page.
describe("the student's team page is mounted", () => {
  it("the notice links to /zadatak/<id>/tim", () => {
    const source = readFileSync(join(import.meta.dirname, "../notice/NoticePage.tsx"), "utf8");
    expect(source).toContain("/tim`");
    expect(source).toContain("work-team-link");
  });
  it("the route table opens it for a student only", () => {
    expect(resolve("/zadatak/a1/tim", "student")).toMatchObject({ kind: "page" });
    expect(resolve("/zadatak/a1/tim", "teacher")).not.toMatchObject({ kind: "page" });
  });
  it("the Next page renders TeamPage and refuses a malformed id as not found", () => {
    const page = readFileSync(join(import.meta.dirname, "../../../../app/[base]/zadatak/[id]/tim/page.tsx"), "utf8");
    expect(page).toContain("TeamPage");
    expect(page).toContain("notFound()");
  });
});
