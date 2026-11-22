import { describe, expect, it } from "vitest";
import { courseStudentsMessages as m } from "./messages.hr";

describe("N-04 messages", () => {
  it("keeps the prototype wording", () => {
    expect(m.courseTitle("Kolegij A")).toBe("Kolegij A: studenti");
    expect(m.unavailable).toBe("Popis studenata trenutačno nije dostupan. Pokušajte ponovno.");
    expect(m.emptyAction).toBe("Izdaj novi kod");
    expect(m.openSeminar).toBe("Otvori seminarski rad");
  });
});
