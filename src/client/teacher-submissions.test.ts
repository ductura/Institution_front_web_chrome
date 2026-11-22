// WEB-1502 / LOK-WEB-22: the teacher's submissions reads against the bodies of
// the published contract vectors (migration-contract-vectors.generated.json).
// Invented data.
import { describe, expect, it } from "vitest";

import vectors from "./migration-contract-vectors.generated.json";
import { readSubmittedVersion, readTeacherSubmissions, type SubmissionsCall } from "./teacher-submissions";

const ASSIGNMENT = "3a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c01";
const STUDENT = "5e4d3c2b-1a09-4f8e-8d7c-6b5a4f3e2d01";

const SUBMITTED = {
  studentId: STUDENT, documentId: "izmisljeni-rad-0001", submitted: true,
  revision: 42, requestedMinute: "2026-12-15T21:30:00.000Z", afterDeadline: false,
};
const NOT_SUBMITTED = {
  studentId: "5e4d3c2b-1a09-4f8e-8d7c-6b5a4f3e2d02", documentId: null, submitted: false,
  revision: null, requestedMinute: null, afterDeadline: null,
};
const LIST_BODY = { submissions: [SUBMITTED, NOT_SUBMITTED] };
const DETAIL_BODY = { studentId: STUDENT, revision: 42, late: false, document: "{\"nodes\":[],\"schemaVersion\":2}" };

const vectorBody = (route: string, name: string): unknown => {
  const found = (vectors as { route: string; name: string; response: { body?: unknown } }[]).find((v) => v.route === route && v.name === name);
  if (found === undefined) throw new Error(`no vector ${route} ${name}`);
  return found.response.body;
};

function answering(body: unknown, status = 200): SubmissionsCall & { calls: unknown[] } {
  const calls: unknown[] = [];
  const call = (async (id, input) => {
    calls.push([id, input]);
    return status === 200 ? { ok: true, status, body } : { ok: false, status, code: "x" };
  }) as SubmissionsCall & { calls: unknown[] };
  call.calls = calls;
  return call;
}

describe("readTeacherSubmissions", () => {
  it("reads the contract vector: one row per submitted student, none for the others", async () => {
    const result = await readTeacherSubmissions(answering(vectorBody("teacher.submissions.get", "submissions")), ASSIGNMENT);
    expect(result.kind).toBe("ready");
    const rows = result.kind === "ready" ? result.rows : [];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toEqual({ studentId: STUDENT, revision: 42, late: false, requestedMinute: "2026-12-15T21:30:00.000Z" });
    expect(rows.map((r) => r.studentId)).not.toContain("5e4d3c2b-1a09-4f8e-8d7c-6b5a4f3e2d02");
  });

  it("reads one row with its time and sends the assignment", async () => {
    const call = answering(LIST_BODY);
    expect(await readTeacherSubmissions(call, ASSIGNMENT)).toEqual({
      kind: "ready",
      rows: [{ studentId: STUDENT, revision: 42, late: false, requestedMinute: "2026-12-15T21:30:00.000Z" }],
    });
    expect(call.calls).toEqual([["teacher.submissions.get", { params: { assignmentId: ASSIGNMENT } }]]);
  });

  it("takes late only from the server's afterDeadline flag, never from the time", async () => {
    const late = await readTeacherSubmissions(answering({ submissions: [{ ...SUBMITTED, afterDeadline: true }] }), ASSIGNMENT);
    expect(late.kind === "ready" && late.rows[0]?.late).toBe(true);
    const farTime = await readTeacherSubmissions(answering({ submissions: [{ ...SUBMITTED, requestedMinute: "2099-12-31T23:59:00.000Z" }] }), ASSIGNMENT);
    expect(farTime.kind === "ready" && farTime.rows[0]?.late).toBe(false);
  });

  it("reads the empty vector as no rows", async () => {
    expect(await readTeacherSubmissions(answering(vectorBody("teacher.submissions.get", "none-or-not-the-teacher")), ASSIGNMENT))
      .toEqual({ kind: "ready", rows: [] });
  });

  it.each([
    ["an unknown field", { ...LIST_BODY, extra: 1 }],
    ["the old submittedVersions list", { ...LIST_BODY, submittedVersions: [] }],
    ["an unknown row field", { submissions: [{ ...SUBMITTED, deadline: "x" }] }],
    ["a time with no calendar date", { submissions: [{ ...SUBMITTED, requestedMinute: "2026-13-15T21:30:00.000Z" }] }],
    ["a string lateness", { submissions: [{ ...SUBMITTED, afterDeadline: "true" }] }],
    ["a student twice", { submissions: [SUBMITTED, { ...NOT_SUBMITTED, studentId: STUDENT }] }],
  ])("reads %s as nepoznato", async (_name, body) => {
    expect(await readTeacherSubmissions(answering(body), ASSIGNMENT)).toEqual({ kind: "nepoznato" });
  });

  it("maps 401 to session-expired and 503 to nepoznato", async () => {
    expect(await readTeacherSubmissions(answering(null, 401), ASSIGNMENT)).toEqual({ kind: "session-expired" });
    expect(await readTeacherSubmissions(answering(null, 503), ASSIGNMENT)).toEqual({ kind: "nepoznato" });
  });
});

describe("readSubmittedVersion", () => {
  it("reads the contract vector body (no submissionId) and asks by student", async () => {
    const body = vectorBody("teacher.submission-detail.get", "submitted-version");
    const call = answering(body);
    expect(await readSubmittedVersion(call, ASSIGNMENT, STUDENT)).toEqual({ kind: "ready", version: body });
    expect(call.calls).toEqual([["teacher.submission-detail.get", { params: { assignmentId: ASSIGNMENT, studentId: STUDENT } }]]);
  });

  it("refuses a version of another student and an unknown field", async () => {
    const other = { ...DETAIL_BODY, studentId: "5e4d3c2b-1a09-4f8e-8d7c-6b5a4f3e2d02" };
    expect(await readSubmittedVersion(answering(other), ASSIGNMENT, STUDENT)).toEqual({ kind: "nepoznato" });
    expect(await readSubmittedVersion(answering({ ...DETAIL_BODY, submissionId: "00000000-0000-4000-8000-0000000000c1" }), ASSIGNMENT, STUDENT))
      .toEqual({ kind: "nepoznato" });
  });

  it("maps 404 to not_found", async () => {
    expect(await readSubmittedVersion(answering(null, 404), ASSIGNMENT, STUDENT)).toEqual({ kind: "greska", code: "not_found" });
  });
});
