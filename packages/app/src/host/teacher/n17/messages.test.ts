import { describe, expect, it } from "vitest";
import { n17Messages as m } from "./messages.hr";

describe("N-17 messages", () => {
  it("keeps the prototype wording", () => {
    expect(m.loading).toBe("Učitavanje zbirnog pregleda…");
    expect(m.unavailable).toBe("Zbirni pregled trenutačno nije dostupan. Pokušajte ponovno.");
    expect(m.emptyTitle).toBe("Nema objavljenih zadataka");
    expect(m.emptyBody).toBe("Zbirni pregled pojavljuje se kad objavite prvi zadatak.");
    expect(m.emptyAction).toBe("Dodaj zadatak");
    expect(m.cardTitle("Kolegij A", "Esej")).toBe("Kolegij A: „Esej”");
    expect(Object.values(m.columns)).toEqual(["Student", "Stanje", "Vrijeme predaje", "Nakon roka", "Stanje zapisa", "Dorada"]);
  });
});
