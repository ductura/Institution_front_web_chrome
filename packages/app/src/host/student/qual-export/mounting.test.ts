import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { resolve } from "../../../routes";

// WEB-V18-KODIRANJE-IZVOZ: the screen is reachable: the route table resolves the path for a student (and only
// for a student), and the Next page of that path mounts the page.
const PATH = "/zadaci/kodiranje-izvoz";

describe("the coding export page is mounted", () => {
  it("the route table opens it for a student only", () => {
    expect(resolve(PATH, "student")).toMatchObject({ kind: "page", page: { label: "Izvoz kodiranja" } });
    expect(resolve(PATH, "teacher")).not.toMatchObject({ kind: "page" });
  });
  it("the Next page renders QualExportPage", () => {
    const page = readFileSync(join(import.meta.dirname, "../../../../app/[base]/zadaci/kodiranje-izvoz/page.tsx"), "utf8");
    expect(page).toContain("QualExportPage");
  });
});
