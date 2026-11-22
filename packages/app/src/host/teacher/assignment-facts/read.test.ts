import { describe, expect, it } from "vitest";

import { readCourseFacts, type FactsCall } from "./read";

// Invented ids and names only.
const S1 = "00000000-0000-4000-8000-000000000001";
const S2 = "00000000-0000-4000-8000-000000000002";
const T1 = "00000000-0000-4000-8000-0000000000a1";
const DUE = "2026-11-08T22:59:00.000Z";

type Answer = { ok: true; status: number; body: unknown } | { ok: false; status: number; code: string };
const fake = (answers: Record<string, Answer | Error>): FactsCall =>
  (async (id: string) => {
    const a = answers[id];
    if (a === undefined) return { ok: false, status: 503, code: "unavailable" };
    if (a instanceof Error) throw a;
    return a;
  }) as unknown as FactsCall;

const roster = (students: unknown[]): Answer => ({ ok: true, status: 200, body: { students } });
const student = (id: string, family: string, state: string, documentId: string | null, assignmentId = T1) =>
  ({ studentId: id, givenName: "Student", familyName: family, groupName: "Grupa 2", assignments: [{ assignmentId, documentId, workState: state }] });

describe("readCourseFacts (WEB-2145)", () => {
  it("joins the roster with the submissions, the overview and the extensions of each assignment", async () => {
    const call = fake({
      "teacher.course-students.get": roster([student(S1, "A", "submitted", "doc-1"), student(S2, "B", "not_started", null)]),
      "teacher.submissions.get": { ok: true, status: 200, body: { submissions: [
        { studentId: S1, documentId: "doc-1", submitted: true, revision: 2, requestedMinute: "2026-11-01T10:00:00.000Z", afterDeadline: false },
        { studentId: S2, documentId: null, submitted: false, revision: null, requestedMinute: null, afterDeadline: null },
      ] } },
      "teacher.assignment-overview.get": { ok: true, status: 200, body: { students: [
        { studentId: S1, givenName: "Student", familyName: "A", groupName: null, submitted: true, requestedMinute: "2026-11-01T10:00:00.000Z", afterDeadline: false, evidenceRecord: "with_gaps" },
      ] } },
      "teacher.deadline-extensions.get": { ok: true, status: 200, body: { extensions: [] } },
    });
    const read = await readCourseFacts(call, "k-a", [{ id: T1, dueAt: DUE }]);
    expect(read.kind).toBe("ready");
    const reads = read.kind === "ready" ? read.reads.get(T1) : undefined;
    expect(reads?.works.map((w) => [w.studentId, w.state, w.documentId])).toEqual([[S1, "submitted", "doc-1"], [S2, "not_started", null]]);
    expect(reads?.details?.get(S1)).toEqual({ requestedMinute: "2026-11-01T10:00:00.000Z", afterDeadline: false, revision: 2, record: "with_gaps" });
    expect(reads?.details?.has(S2)).toBe(false);
    expect(reads?.extensions).toEqual([]);
  });

  it("a failed assignment read leaves only its part out", async () => {
    const call = fake({ "teacher.course-students.get": roster([student(S1, "A", "submitted", "doc-1")]), "teacher.submissions.get": new Error("net") });
    const read = await readCourseFacts(call, "k-a", [{ id: T1, dueAt: DUE }]);
    const reads = read.kind === "ready" ? read.reads.get(T1) : undefined;
    expect(reads?.details).toBeNull();
    expect(reads?.extensions).toBeNull();
    expect(reads?.works).toHaveLength(1);
  });

  it("the roster read failing is unavailable, 401 is signed out, never an empty list", async () => {
    expect(await readCourseFacts(fake({}), "k-a", [{ id: T1, dueAt: DUE }])).toEqual({ kind: "unavailable" });
    expect(await readCourseFacts(fake({ "teacher.course-students.get": new Error("net") }), "k-a", [])).toEqual({ kind: "unavailable" });
    expect(await readCourseFacts(fake({ "teacher.course-students.get": { ok: false, status: 401, code: "unauthorized" } }), "k-a", []))
      .toEqual({ kind: "signedOut" });
  });

  it("a student or an assignment of one student twice is unavailable", async () => {
    const twice = fake({ "teacher.course-students.get": roster([student(S1, "A", "submitted", "doc-1"), student(S1, "A", "submitted", "doc-1")]) });
    expect(await readCourseFacts(twice, "k-a", [{ id: T1, dueAt: DUE }])).toEqual({ kind: "unavailable" });
    const doubled = { ...student(S1, "A", "submitted", "doc-1") };
    doubled.assignments = [...doubled.assignments, ...doubled.assignments];
    expect(await readCourseFacts(fake({ "teacher.course-students.get": roster([doubled]) }), "k-a", [{ id: T1, dueAt: DUE }]))
      .toEqual({ kind: "unavailable" });
  });
});
