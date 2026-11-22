import { describe, expect, it } from "vitest";

import { studentMilestonesHr as t } from "./messages.hr";

describe("student milestone texts", () => {
  it("keeps the confirmation sentence the spec requires", () => {
    expect(t.confirmText).toBe("Kad pošalješ etapu, mentor vidi verziju rada iz tog trenutka. Možeš nastaviti pisati; nove izmjene idu u sljedeću etapu.");
    expect(t.send).toBe("Pošalji etapu na pregled");
  });
  it("claims no grading or authorship words", () => {
    const all = JSON.stringify(t).toLowerCase();
    for (const word of ["ocjen", "bod", "sumnj", "varanj", "plagij"]) expect(all).not.toContain(word);
  });
});
