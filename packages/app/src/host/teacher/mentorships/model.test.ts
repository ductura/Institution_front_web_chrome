import { describe, expect, it } from "vitest";

import { dayText, latestRecord, mentorshipsOf, startedWorks, studentsOf } from "./model";

const work = (id: string, student: { givenName: string; familyName: string } | null) => ({
  mentorshipId: id, assignmentId: id, documentId: null, student, title: "Izmišljeni rad",
  workType: "bachelor_thesis" as const, workState: "not_started" as const,
});

describe("studentsOf", () => {
  it("is one row per mentorship in the server's order: equal names are not merged, no name pair is never named", () => {
    const iva = { givenName: "Iva", familyName: "Izmišljena" };
    const rows = studentsOf([work("a", iva), work("b", null), work("c", iva)]);
    expect(rows.map((r) => [r.key, r.name])).toEqual([["a", "Iva Izmišljena"], ["b", null], ["c", "Iva Izmišljena"]]);
  });
  it("is empty for no works", () => {
    expect(studentsOf([])).toEqual([]);
  });
});

describe("mentorshipsOf (PIL-K-ROKOVI)", () => {
  it("is one key-dates card per mentorship, in the works list order by family name", () => {
    const ana = { givenName: "Ana", familyName: "Zmišljena" };
    const iva = { givenName: "Iva", familyName: "Izmišljena" };
    const rows = mentorshipsOf([work("a", ana), work("b", iva), work("b", iva), work("c", null)]);
    expect(rows.map((r) => r.mentorshipId)).toEqual(["b", "a", "c"]);
    expect(rows[0]!.name).toBe("Iva Izmišljena");
    expect(rows[2]!.name).not.toBe("");
  });
});

describe("WEB-NF6-ETAPE: startedWorks, latestRecord, dayText", () => {
  const started = (id: string, doc: string | null, familyName: string) => ({
    ...work(id, { givenName: "Iva", familyName }), documentId: doc, workState: doc === null ? "not_started" as const : "in_progress" as const,
  });
  it("keeps the started works once each, in the list's order by family name", () => {
    const rows = startedWorks([started("a", "rad-a", "Zmišljena"), started("b", null, "Anić"), started("c", "rad-c", "Bilić"), started("a", "rad-a", "Zmišljena")] as never);
    expect(rows.map((r) => r.documentId)).toEqual(["rad-c", "rad-a"]);
  });
  it("takes the latest consultation by day, the later one on a tie, none for no records", () => {
    expect(latestRecord([])).toBeNull();
    const rows = [{ heldOn: "2026-11-05", n: 1 }, { heldOn: "2026-11-20", n: 2 }, { heldOn: "2026-11-20", n: 3 }, { heldOn: "2026-10-01", n: 4 }];
    expect(latestRecord(rows)?.n).toBe(3);
  });
  it("writes a calendar day the Croatian way and leaves anything else as it is", () => {
    expect(dayText("2026-11-05")).toBe("5. 11. 2026.");
    expect(dayText("nije datum")).toBe("nije datum");
  });
});
