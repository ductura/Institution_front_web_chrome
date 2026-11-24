import { describe, expect, it } from "vitest";

import { CATEGORIES, routingFor, viewerOf } from "./routing";

describe("routing of problem reports (NF-7 OA-7, Daniel 23. 11. t. 8)", () => {
  it("covers exactly the categories the student's form sends", () => {
    expect(CATEGORIES).toEqual(["technical", "course", "account"]);
    expect(routingFor("operator").map((row) => row.handler)).toEqual(["operater", "nastavnik", "administrator fakulteta"]);
  });

  it("marks only the reader's own category", () => {
    expect(routingFor("operator").filter((row) => row.yours).map((row) => row.category)).toEqual(["technical"]);
    expect(routingFor("admin").filter((row) => row.yours).map((row) => row.category)).toEqual(["account"]);
  });

  it("reads the administrator from the shell role and everyone else let in as the operator", () => {
    expect(viewerOf("admin")).toBe("admin");
    expect(viewerOf(null)).toBe("operator");
    expect(viewerOf("teacher")).toBe("operator");
  });
});
