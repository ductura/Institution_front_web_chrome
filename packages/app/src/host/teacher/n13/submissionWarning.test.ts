// NAS-R14 (NAS-26): the warning about an existing submission before the extension is saved, with the time; invented ids only.
import { describe, expect, it } from "vitest";

import { FAKE_DATA } from "./fake-port";
import { submissionWarning } from "./model";
import { readExtensionSubmissions, type SubmissionsCall } from "./submissions";

const students = FAKE_DATA.students;
const subs = FAKE_DATA.submissions;

describe("submissionWarning", () => {
  it("names the student and the time for one student who already submitted", () => {
    expect(submissionWarning("one", "s-2", students, subs)).toEqual({
      tone: "status", bold: "Predaja studenta Marko Babić već postoji (zatraženo 8. 11. 2026. u 22:15).", rest: expect.stringContaining("ne mijenja te predaje"),
    });
  });
  it("is silent for a student without a submission and before one is chosen", () => {
    expect(submissionWarning("one", "s-1", students, subs)).toBeNull();
    expect(submissionWarning("one", "", students, subs)).toBeNull();
  });
  it("covers all students too, listing who and when", () => {
    const w = submissionWarning("all", "", students, subs);
    expect(w?.bold).toBe("Predaja već postoji kod 1 studenta:");
    expect(w?.rest).toContain("Marko Babić (8. 11. 2026. u 22:15)");
    expect(submissionWarning("all", "", students, [])).toBeNull();
  });
  it("says it cannot tell when the submissions could not be read, never that nobody submitted", () => {
    expect(submissionWarning("one", "s-1", students, null)?.bold).toMatch(/nije moguće provjeriti/);
    expect(submissionWarning("all", "", students, null)?.bold).toMatch(/nije moguće provjeriti/);
  });
});

describe("readExtensionSubmissions", () => {
  const A = "00000000-0000-4000-8000-0000000000a1";
  const rows = [
    { studentId: "s-1", submitted: true as const, requestedMinute: "2026-11-08T21:15:00.000Z" },
    { studentId: "s-2", submitted: false as const, requestedMinute: null },
  ];
  const answer = (body: unknown, ok = true, status = 200): SubmissionsCall => (async () => (ok ? { ok: true, status: 200, body } : { ok: false, status, code: "x" })) as SubmissionsCall;
  it("keeps only submitted rows of this assignment", async () => {
    expect(await readExtensionSubmissions(answer({ assignments: [{ assignmentId: A, submissions: rows }] }), A)).toEqual([{ studentId: "s-1", requestedMinute: "2026-11-08T21:15:00.000Z" }]);
  });
  it("an error, a throw or another assignment's answer is null, not an empty list", async () => {
    expect(await readExtensionSubmissions(answer({}, false, 503), A)).toBeNull();
    expect(await readExtensionSubmissions((async () => { throw new Error("x"); }) as SubmissionsCall, A)).toBeNull();
    expect(await readExtensionSubmissions(answer({ assignments: [{ assignmentId: "00000000-0000-4000-8000-0000000000b2", submissions: rows }] }), A)).toBeNull();
  });
});
