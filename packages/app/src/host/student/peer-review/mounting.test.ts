import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { resolve } from "../../../routes";

// WEB-V19-RECENZIJA-STUDENT: the screens are reachable: the notice of the assignment links to the list, the
// route table opens the three paths for a student only, and each Next page mounts its screen and refuses a
// malformed id as not found.
const next = (rel: string) => readFileSync(join(import.meta.dirname, "../../../../app/(host)/zadatak/[id]/recenzija", rel), "utf8");

describe("the student's peer review is mounted", () => {
  it("the notice links to /zadatak/<id>/recenzija", () => {
    const source = readFileSync(join(import.meta.dirname, "../notice/NoticePage.tsx"), "utf8");
    expect(source).toContain("/recenzija`");
    expect(source).toContain("peer-review-link");
  });
  it.each(["/zadatak/a1/recenzija", "/zadatak/a1/recenzija/primljene", "/zadatak/a1/recenzija/rad/t1"])("%s opens for a student only", (path) => {
    expect(resolve(path, "student")).toMatchObject({ kind: "page" });
    expect(resolve(path, "teacher")).not.toMatchObject({ kind: "page" });
    expect(resolve(path, null)).not.toMatchObject({ kind: "page" });
  });
  it("the Next pages render the screens and refuse a malformed id", () => {
    for (const [file, name] of [["page.tsx", "TasksPage"], ["primljene/page.tsx", "ReceivedPage"], ["rad/[taskId]/page.tsx", "ReviewPage"]] as const) {
      const page = next(file);
      expect(page).toContain(name);
      expect(page).toContain("notFound()");
    }
    expect(next("rad/[taskId]/page.tsx")).toMatch(/!uuid\.test\(id\) \|\| !uuid\.test\(taskId\)/);
  });
});
