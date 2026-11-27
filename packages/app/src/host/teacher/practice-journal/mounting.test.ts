import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { resolve } from "../../../routes";

// WEB-V19-DNEVNIK-MENTOR: the screen is reachable: N-16 links to a path the route table resolves for a
// teacher (and only for a teacher), and the Next page of that path mounts the mentor's page.
const PATH = "/nastavnik/mentorstva/dnevnik-prakse";

describe("the mentor's journal is mounted", () => {
  it("N-16 links to the path", () => {
    const source = readFileSync(join(import.meta.dirname, "../mentorships/MentorshipsPage.tsx"), "utf8");
    expect(source).toContain(`"${PATH}"`);
  });
  it("the route table opens it for a teacher only", () => {
    expect(resolve(PATH, "teacher")).toMatchObject({ kind: "page" });
    expect(resolve(PATH, "student")).not.toMatchObject({ kind: "page" });
  });
  it("the Next page renders MentorJournalPage", () => {
    const page = readFileSync(join(import.meta.dirname, "../../../../app/(host)/nastavnik/mentorstva/dnevnik-prakse/page.tsx"), "utf8");
    expect(page).toContain("MentorJournalPage");
  });
});
