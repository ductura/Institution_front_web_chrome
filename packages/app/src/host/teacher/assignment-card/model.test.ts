import { describe, expect, it } from "vitest";

import { enrolledText, nextDeadline, practiceOf, readPractice, roleOf, type AssignmentRead } from "./model";

const a = (id: string, dueAt: string) => ({ id, title: id, workType: "x", opensAt: dueAt, dueAt, currentVersion: 1, enrolledStudents: 1 });

describe("N-01 card model", () => {
  it("picks the nearest deadline not yet passed", () => {
    const course = { assignments: [a("old", "2026-10-15T21:59:00Z"), a("far", "2026-12-01T22:59:00Z"), a("near", "2026-11-08T22:59:00Z")] };
    expect(nextDeadline(course, Date.parse("2026-11-01T00:00:00Z"))?.id).toBe("near");
    expect(nextDeadline(course, Date.parse("2027-01-01T00:00:00Z"))).toBeNull();
  });
  it("says role unknown without a view and maps an assistant to collaborator", () => {
    expect(roleOf(null)).toBe("unknown");
    expect(roleOf({ role: "assistant", groups: [] } as never)).toBe("collaborator");
    expect(roleOf({ role: "holder" } as never)).toBe("holder");
  });
  it("counts students with Croatian plurals and lists groups", () => {
    const view = { role: "holder", students: [{}, {}, {}, {}], groups: [{ name: "grupa 2" }, { name: "grupa 4" }] } as never;
    expect(enrolledText(view)).toBe("4 studenta · grupa 2, grupa 4");
    expect(enrolledText(null)).toBeNull();
  });
});

describe("P-D1 practice badge on the card and the task facts", () => {
  // Invented assignment, as institution.assignment.get answers it.
  const value = (isPractice?: boolean) => ({
    assignmentId: "a-1", courseId: "k-1", versionNo: 1, title: "Izmišljeni zadatak", instructions: "", workType: "essay",
    opensAt: "2026-11-01T08:00:00Z", dueAt: "2026-12-01T22:59:00Z", aiPolicy: "prohibited", aiPurposes: [],
    evidenceProfile: "basic", importAllowed: false, wordMin: null, wordMax: null, ...(isPractice === undefined ? {} : { isPractice }),
  }) as Extract<AssignmentRead, { kind: "ready" }>["value"];
  it("is practice only for a ready read with isPractice: true", () => {
    expect(practiceOf({ kind: "ready", value: value(true) })).toBe(true);
    expect(practiceOf({ kind: "ready", value: value(false) })).toBe(false);
    expect(practiceOf({ kind: "ready", value: value() })).toBe(false);
    expect(practiceOf({ kind: "notTeacher" })).toBe(false);
    expect(practiceOf({ kind: "unavailable" })).toBe(false);
  });
  it("reads each assignment and never guesses on a failed read", async () => {
    const reads: Record<string, () => Promise<AssignmentRead>> = {
      p: async () => ({ kind: "ready", value: value(true) }),
      r: async () => ({ kind: "ready", value: value(false) }),
      n: async () => ({ kind: "ready", value: value() }),
      x: async () => { throw new Error("mreža"); },
      u: async () => ({ kind: "unavailable" }),
    };
    const flags = await readPractice(["p", "r", "n", "x", "u"], (id) => reads[id]!());
    expect([...flags]).toEqual([["p", true], ["r", false], ["n", false], ["x", false], ["u", false]]);
    expect((await readPractice([], async () => ({ kind: "unavailable" }))).size).toBe(0);
  });
});
