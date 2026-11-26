import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { resolve } from "../../../routes";

// WEB-V18-UPITNIK-IZVOZ: the screen is reachable: the route table resolves the path for a teacher (and only for
// a teacher), and the Next page of that path mounts the page and refuses a malformed id.
const PATH = "/nastavnik/upitnici/11111111-1111-4111-8111-111111111111/izvoz";

describe("the questionnaire export page is mounted", () => {
  it("the route table opens it for a teacher only", () => {
    expect(resolve(PATH, "teacher")).toMatchObject({ kind: "page", page: { label: "Izvoz odgovora upitnika", current: "/nastavnik" } });
    expect(resolve(PATH, "student")).not.toMatchObject({ kind: "page" });
  });
  it("the Next page renders QuestionnaireExportPage for a valid id only", () => {
    const page = readFileSync(join(import.meta.dirname, "../../../../app/[base]/nastavnik/upitnici/[questionnaireId]/izvoz/page.tsx"), "utf8");
    expect(page).toContain("QuestionnaireExportPage");
    expect(page).toContain("notFound()");
  });
});
