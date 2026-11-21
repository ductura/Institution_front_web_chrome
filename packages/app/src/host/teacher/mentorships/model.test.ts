import { describe, expect, it } from "vitest";

import { studentsOf } from "./model";

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
