import { describe, expect, it } from "vitest";
import { COLUMN_HEADERS } from "./model";
import { merlinMessages as m } from "./messages.hr";

describe("N-18 messages", () => {
  it("keeps the prototype wording", () => {
    expect(m.title).toBe("Izvoz za Merlin");
    expect(m.loading).toBe("Učitavanje predaja…");
    expect(m.unavailable).toBe("Predaje trenutačno nije moguće učitati. Pokušajte ponovno.");
    expect(m.preparing).toBe("Paket se priprema. Možete napustiti stranicu; paket ostaje u pripremi.");
    expect(m.ready).toContain("za odabrani zadatak");
    expect(m.prepare).toBe("Pripremi paket za Merlin");
    expect(m.csv).toBe("Preuzmi samo popis");
  });
  it("has the eight CSV columns of the prototype", () => {
    expect(COLUMN_HEADERS).toEqual([
      "Prezime", "Ime", "Predano", "Vrijeme predaje", "Nakon roka", "Naziv datoteke u zipu", "Otisak PDF", "Otisak .docx",
    ]);
  });
});
