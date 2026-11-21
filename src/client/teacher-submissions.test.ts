// WEB-1502: readAssignmentSubmissions over invented answers of teacher.submissions.get.
import { describe, expect, it } from "vitest";

import { readAssignmentSubmissions, type SubmissionsCall } from "./teacher-submissions";

const A = "00000000-0000-4000-8000-0000000000a1";
const S = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const done = { studentId: S(1), documentId: S(9), submitted: true, revision: 2, requestedMinute: "2026-11-02T13:32Z", afterDeadline: true };
const open = { studentId: S(2), documentId: null, submitted: false, revision: null, requestedMinute: null, afterDeadline: null };
const answer = (status: number, body: unknown): SubmissionsCall => async () => (status === 200 ? { ok: true, status, body } : { ok: false, status, code: "x" });

describe("readAssignmentSubmissions", () => {
  it("passes the rows as they came, `afterDeadline` included", async () => {
    expect(await readAssignmentSubmissions(answer(200, { submissions: [done, open] }), A)).toEqual({ kind: "ready", rows: [done, open] });
  });
  it("asks teacher.submissions.get for the assignment, once", async () => {
    const calls: unknown[] = [];
    await readAssignmentSubmissions(async (id, input) => { calls.push([id, input.params]); return { ok: true, status: 200, body: { submissions: [] } }; }, A);
    expect(calls).toEqual([["teacher.submissions.get", { assignmentId: A }]]);
  });
  it("reads an empty list as ready and empty", async () => {
    expect(await readAssignmentSubmissions(answer(200, { submissions: [] }), A)).toEqual({ kind: "ready", rows: [] });
  });
  it("maps 401, 403 and the rest", async () => {
    expect((await readAssignmentSubmissions(answer(401, null), A)).kind).toBe("signedOut");
    expect((await readAssignmentSubmissions(answer(403, null), A)).kind).toBe("notTeacher");
    expect((await readAssignmentSubmissions(answer(503, null), A)).kind).toBe("unavailable");
    expect((await readAssignmentSubmissions(async () => { throw new Error("down"); }, A)).kind).toBe("unavailable");
  });
  it("refuses a contradictory or duplicated list instead of showing it", async () => {
    for (const bad of [
      [done, done],
      [{ ...done, revision: null }],
      [{ ...done, requestedMinute: "2026-02-30T10:00Z" }],
      [{ ...done, afterDeadline: null }],
      [{ ...open, afterDeadline: true }],
    ]) expect((await readAssignmentSubmissions(answer(200, { submissions: bad }), A)).kind).toBe("unavailable");
    expect((await readAssignmentSubmissions(answer(200, {}), A)).kind).toBe("unavailable");
  });
});
