import { describe, expect, it } from "vitest";
import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import { n13Messages as m } from "./messages.hr";

describe("N-13 messages", () => {
  it("keeps the prototype wording", () => {
    expect(m.loading).toBe("Učitavanje rokova…");
    expect(m.unavailable).toBe("Rokove trenutačno nije moguće učitati. Pokušajte ponovno.");
    expect(m.empty).toBe("Nijedan rok nije produljen.");
    expect(m.scopeAll(4)).toBe("Svi studenti zadatka (4)");
    expect(m.reasonHint(false)).toBe("Razlog se bira s popisa, bez slobodnog teksta. Vidite ga samo Vi i ovaj student.");
    expect(m.recorded + " " + m.recordedRest).toBe("Produljenje je zabilježeno. Student vidi novi rok uz zadatak. Razlog vidite samo Vi i taj student.");
    expect(m.conflict("Ana Horvat") + " " + m.conflictRest).toContain("Produljenje ne mijenja tu predaju; bilježi se kao dopuna uz nju.");
    expect(m.lead("Esej", "Kolegij A", "8. 11. 2026. u 23:59")).toBe("Zadatak „Esej”, Kolegij A, rok 8. 11. 2026. u 23:59. Produljenje pokrećete samo Vi; student ga ne traži kroz Ducturu.");
    expect(m.lead(null, null, null)).toBe("Produljenje pokrećete samo Vi; student ga ne traži kroz Ducturu.");
  });
  it("holds no forbidden term", () => {
    const strings = (v: unknown): string[] => typeof v === "string" ? [v] : typeof v === "function" ? [] : Object.values(v as object).flatMap(strings);
    for (const s of strings(m)) expect(findForbiddenTerms(s, "hr")).toEqual([]);
  });
});
