import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { resolve } from "../../../routes";

// WEB-V18-KODIRANJE-OZNAKE: the screen is reachable: the route table resolves the path for a student (and only
// for a student), the Next page mounts it, and the material list links to it.
describe("the coding page is mounted", () => {
  it("the route table opens it for a student only", () => {
    expect(resolve("/zadaci/kodiranje", "student")).toMatchObject({ kind: "page", page: { label: "Kodiranje" } });
    expect(resolve("/zadaci/kodiranje", "teacher")).not.toMatchObject({ kind: "page" });
  });
  it("the Next page renders the coding route", () => {
    const page = readFileSync(join(import.meta.dirname, "../../../../app/[base]/zadaci/kodiranje/page.tsx"), "utf8");
    expect(page).toContain("QualCodingRoute");
  });
  it("the list of materials links to it with the material's id", () => {
    const list = readFileSync(join(import.meta.dirname, "../qual-materials/QualMaterialsPage.tsx"), "utf8");
    expect(list).toContain("/zadaci/kodiranje?gradivo=${m.id}");
  });
});
