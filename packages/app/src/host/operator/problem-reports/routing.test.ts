import { describe, expect, it } from "vitest";

import contracts from "../../../../../../src/client/migration-contracts.generated.json";
import { CATEGORIES, routingFor, viewerOf } from "./routing";

/** The `category` values support.problem-reports.post accepts, read from the contract extract. */
function contractCategories(): string[] {
  const route = (contracts as Record<string, { body?: { properties?: Record<string, { anyOf?: { const?: unknown }[] }> } }>)["support.problem-reports.post"];
  const options = route?.body?.properties?.category?.anyOf ?? [];
  return options.map((option) => option.const).filter((value): value is string => typeof value === "string");
}

describe("routing of problem reports (NF-7 OA-7, Daniel 23. 11. t. 8)", () => {
  it("covers exactly the categories the student's form sends", () => {
    const sent = contractCategories();
    expect(sent.length).toBeGreaterThan(0);
    expect([...CATEGORIES].sort()).toEqual([...sent].sort());
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
