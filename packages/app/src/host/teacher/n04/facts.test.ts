// WEB-NUZ-NZ NZ-10: the N-04 row with the facts the reads give (time, version, record, extended deadline).
// A part that was not read is left out, never guessed. Invented data only.
import { describe, expect, it } from "vitest";

import { extensionLine, stateLine, type RosterWork } from "./model";
import { factsOf } from "./port";

const DUE = "2026-12-15T22:59:00.000Z";
const work = (extra: Partial<RosterWork>): RosterWork => ({ assignmentId: "a1", title: "Esej", workType: "essay", status: "submitted", ...extra });
const details = new Map([["s1", { requestedMinute: "2026-11-05T20:14Z", afterDeadline: false, revision: 2, record: "with_gaps" as const }]]);

describe("N-04 factsOf (NZ-10)", () => {
  it("gives a submitted work its time, version and record", () => {
    const facts = factsOf({ dueAt: DUE, details, extensions: [] }, "s1");
    expect(facts).toEqual({ submittedAt: "2026-11-05T20:14Z", afterDeadline: false, version: 2, record: "with_gaps", extendedTo: null });
    expect(stateLine(work(facts))).toBe("Predano 5. 11. 2026. u 21:14, prije roka · verzija 2 · zapis ima praznine");
  });
  it("gives an unsubmitted work its extended deadline only", () => {
    const facts = factsOf({ dueAt: DUE, details, extensions: [{ scope: "one", studentId: "s2", dueAt: "2026-12-20T22:59:00.000Z" }] }, "s2");
    expect(facts).toEqual({ extendedTo: "2026-12-20T22:59:00.000Z" });
    expect(extensionLine(work({ status: "writing", ...facts }))).toBe("Rok produljen do 20. 12. 2026. u 23:59.");
    expect(extensionLine(work({ status: "submitted", ...facts }))).toBeNull();
  });
  it("leaves everything out when the reads failed", () => {
    expect(factsOf({ dueAt: DUE, details: null, extensions: null }, "s1")).toEqual({});
    expect(factsOf(undefined, "s1")).toEqual({});
    expect(extensionLine(work({ status: "writing" }))).toBeNull();
  });
});
