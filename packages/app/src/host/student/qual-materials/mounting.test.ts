import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { resolve } from "../../../routes";

// WEB-V18-KODIRANJE-GRADIVO: the screen is reachable: the route table resolves the path for a student (and
// only for a student), and the Next page of that path mounts the page.
const PATH = "/zadaci/gradivo-kodiranja";

describe("the coding materials page is mounted", () => {
  it("the route table opens it for a student only", () => {
    expect(resolve(PATH, "student")).toMatchObject({ kind: "page", page: { label: "Gradivo za kodiranje" } });
    expect(resolve(PATH, "teacher")).not.toMatchObject({ kind: "page" });
  });
  it("the Next page renders QualMaterialsPage", () => {
    const page = readFileSync(join(import.meta.dirname, "../../../../app/[base]/zadaci/gradivo-kodiranja/page.tsx"), "utf8");
    expect(page).toContain("QualMaterialsPage");
  });
});
