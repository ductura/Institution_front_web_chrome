// ED-06 (NF2-P14): with one sent version the student is told why there is no comparison.
import { describe, expect, it } from "vitest";

import { emptyText } from "./VersionComparison";

describe("emptyText", () => {
  it("adds the reason when there is exactly one version", () => {
    expect(emptyText(1)).toBe("Za usporedbu su potrebne dvije poslane verzije. Za sada postoji jedna verzija, pa se usporedba ne nudi.");
  });

  it("says only the rule when there is none", () => {
    expect(emptyText(0)).toBe("Za usporedbu su potrebne dvije poslane verzije.");
  });
});
