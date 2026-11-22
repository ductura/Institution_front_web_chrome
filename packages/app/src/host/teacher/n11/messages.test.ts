import { describe, expect, it } from "vitest";
import { n11Messages as m } from "./messages.hr";

describe("N-11 messages", () => {
  it("keeps the prototype wording", () => {
    expect(m.selectLabel).toBe("Usporedi s …");
    expect(m.selectHint).toBe("Popis sadrži samo poslane verzije. Zadano se zadnja poslana verzija uspoređuje s prethodnom.");
    expect(m.wordsNote).toBe("Broj riječi je opis, bez boje i bez praga.");
    expect(m.empty).toBe("Postoji samo jedna poslana verzija ovog rada, pa usporedbe još nema. Međustanja se vide uživo i u reprodukciji.");
    expect(m.emptyAction).toBe("Otvori reprodukciju");
    expect(m.loadingVersions).toBe("Učitavam poslane verzije…");
    expect(m.versionsError).toBe("Verzije trenutačno nije moguće učitati. Pokušajte ponovno.");
    expect(m.current("5. 11. 2026. u 21:14", 2)).toBe("Predana verzija · 5. 11. 2026. u 21:14 · verzija 2");
    expect(m.option("28. 10. 2026. u 10:50", 1)).toBe("Poslano na pregled · 28. 10. 2026. u 10:50 · verzija 1");
  });
  it("counts words with the right form", () => {
    expect([1, 2, 11, 21, 186, 41].map(m.words)).toEqual(["1 riječ", "2 riječi", "11 riječi", "21 riječ", "186 riječi", "41 riječ"]);
  });
});
