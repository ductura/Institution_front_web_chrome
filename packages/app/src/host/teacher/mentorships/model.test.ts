import { describe, expect, it } from "vitest";

import { studentsOf } from "./model";

const work = (id: string, student: { givenName: string; familyName: string } | null) => ({
  mentorshipId: id, assignmentId: id, documentId: null, student, title: "Izmišljeni rad",
  workType: "bachelor_thesis" as const, workState: "not_started" as const,
});

describe("studentsOf", () => {
  it("is one row per student, in the server's order, and never names a student without a name pair", () => {
    const iva = { givenName: "Iva", familyName: "Izmišljena" };
    const rows = studentsOf([work("a", iva), work("b", null), work("c", iva), work("d", null)]);
    expect(rows.map((r) => [r.name, r.works.length])).toEqual([["Iva Izmišljena", 2], [null, 1], [null, 1]]);
  });
  it("is empty for no works", () => {
    expect(studentsOf([])).toEqual([]);
  });
});
