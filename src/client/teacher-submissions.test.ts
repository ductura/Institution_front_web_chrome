// WEB-1502: the teacher's submissions reads against the bodies of the SRV-1508 vectors
// (Institution_server #538), copied here until the contract is published. Invented data.
import { describe, expect, it } from "vitest";

import { readSubmittedVersion, readTeacherSubmissions, type SubmissionsCall } from "./teacher-submissions";

const ASSIGNMENT = "3a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c01";
const STUDENT = "5e4d3c2b-1a09-4f8e-8d7c-6b5a4f3e2d01";
const SUBMISSION = "00000000-0000-4000-8000-0000000000c1";

const VERSION = { studentId: STUDENT, submissionId: SUBMISSION, revision: 42, late: false };
const SUBMITTED = {
  studentId: STUDENT, documentId: "izmisljeni-rad-0001", submitted: true,
  revision: 42, requestedMinute: "2026-12-15T21:30:00.000Z", afterDeadline: false,
};
const NOT_SUBMITTED = {
  studentId: "5e4d3c2b-1a09-4f8e-8d7c-6b5a4f3e2d02", documentId: null, submitted: false,
  revision: null, requestedMinute: null, afterDeadline: null,
};
const LIST_BODY = { submittedVersions: [VERSION], submissions: [SUBMITTED, NOT_SUBMITTED] };
const DETAIL_BODY = { ...VERSION, document: "{\"nodes\":[],\"schemaVersion\":2}" };

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
  it("reads the vector body: one row with the time of the same revision", async () => {
    const call = answering(LIST_BODY);
    expect(await readTeacherSubmissions(call, ASSIGNMENT)).toEqual({
      kind: "ready",
      rows: [{ studentId: STUDENT, revision: 42, late: false, submissionId: SUBMISSION, requestedMinute: "2026-12-15T21:30:00.000Z" }],
    });
    expect(call.calls).toEqual([["teacher.submissions.get", { params: { assignmentId: ASSIGNMENT } }]]);
  });

  it("takes late only from the version, never from afterDeadline", async () => {
    const lateVersion = await readTeacherSubmissions(answering({ ...LIST_BODY, submittedVersions: [{ ...VERSION, late: true }] }), ASSIGNMENT);
    expect(lateVersion.kind === "ready" && lateVersion.rows[0]?.late).toBe(true);
    const lateRow = await readTeacherSubmissions(answering({ ...LIST_BODY, submissions: [{ ...SUBMITTED, afterDeadline: true }] }), ASSIGNMENT);
    expect(lateRow.kind === "ready" && lateRow.rows[0]?.late).toBe(false);
  });

  it("shows no time when no submissions row has that revision, and keeps an unbound receipt", async () => {
    const result = await readTeacherSubmissions(answering({
      submittedVersions: [{ ...VERSION, submissionId: null, revision: 43 }], submissions: [SUBMITTED],
    }), ASSIGNMENT);
    expect(result).toEqual({ kind: "ready", rows: [{ studentId: STUDENT, revision: 43, late: false, submissionId: null, requestedMinute: null }] });
  });

  it("reads an empty list as no rows", async () => {
    expect(await readTeacherSubmissions(answering({ submittedVersions: [], submissions: [] }), ASSIGNMENT)).toEqual({ kind: "ready", rows: [] });
  });

  it("reads an answer without submittedVersions as no rows: the server leaves it out when none is recorded", async () => {
    expect(await readTeacherSubmissions(answering({ submissions: [SUBMITTED, NOT_SUBMITTED] }), ASSIGNMENT)).toEqual({ kind: "ready", rows: [] });
  });

  it.each([
    ["an unknown field", { ...LIST_BODY, extra: 1 }],
    ["an unknown version field", { ...LIST_BODY, submittedVersions: [{ ...VERSION, deadline: "x" }] }],
    ["a time with no calendar date", { ...LIST_BODY, submissions: [{ ...SUBMITTED, requestedMinute: "2026-13-15T21:30:00.000Z" }] }],
    ["a string lateness", { ...LIST_BODY, submittedVersions: [{ ...VERSION, late: "true" }] }],
    ["a student twice", { ...LIST_BODY, submittedVersions: [VERSION, { ...VERSION, submissionId: null }] }],
  ])("reads %s as nepoznato", async (_name, body) => {
    expect(await readTeacherSubmissions(answering(body), ASSIGNMENT)).toEqual({ kind: "nepoznato" });
  });

  it("maps 401 to session-expired and 503 to nepoznato", async () => {
    expect(await readTeacherSubmissions(answering(null, 401), ASSIGNMENT)).toEqual({ kind: "session-expired" });
    expect(await readTeacherSubmissions(answering(null, 503), ASSIGNMENT)).toEqual({ kind: "nepoznato" });
  });
});

describe("readSubmittedVersion", () => {
  it("reads the vector body and sends both ids", async () => {
    const call = answering(DETAIL_BODY);
    expect(await readSubmittedVersion(call, ASSIGNMENT, SUBMISSION)).toEqual({ kind: "ready", version: DETAIL_BODY });
    expect(call.calls).toEqual([["teacher.submission-detail.get", { params: { assignmentId: ASSIGNMENT, submissionId: SUBMISSION } }]]);
  });

  it("refuses a version of another submission and an unknown field", async () => {
    const other = { ...DETAIL_BODY, submissionId: "00000000-0000-4000-8000-0000000000c2" };
    expect(await readSubmittedVersion(answering(other), ASSIGNMENT, SUBMISSION)).toEqual({ kind: "nepoznato" });
    expect(await readSubmittedVersion(answering({ ...DETAIL_BODY, text: "x" }), ASSIGNMENT, SUBMISSION)).toEqual({ kind: "nepoznato" });
  });

  it("maps 404 to not_found", async () => {
    expect(await readSubmittedVersion(answering(null, 404), ASSIGNMENT, SUBMISSION)).toEqual({ kind: "greska", code: "not_found" });
  });
});
