// #2028 (after DAN-871): readTeacherCourses and readMentoredWorks through the
// real createApi over the fake server of @ductura/test-fakes, every vector of
// teacher.courses.get and teacher.mentorships.get, so the screens' reads and
// the contract meet here.
import type { AddressInfo } from "node:net";
import { createFakeServer, FAKE_VECTOR_HEADER, VECTORS, type FakeVector } from "@ductura/test-fakes/fake-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readMentoredWorks, type MentoredWorksCall } from "../components/teacher/mentored-works-read";
import { readTeacherCourses, type TeacherCoursesCall } from "../components/teacher/teacher-courses-read";
import { createApi } from "./api";
import { readSubmissionState, type SubmissionReceipt } from "./submission";
import { readAssignmentOverview, readCourseStudents, readTeacherReceipt, type TeacherCall } from "./teacher-reads";

const server = createFakeServer();
let baseUrl = "";

beforeAll(async () => {
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((done) => server.close(() => done())));

/** createApi over the fake server, answering with the vector; counts requests. */
function over(vector: FakeVector, sent: { count: number }) {
  return createApi({
    baseUrl,
    fetchImpl: (input, init) => {
      sent.count += 1;
      const headers = new Headers(init?.headers);
      for (const [name, value] of Object.entries(vector.request.headers ?? {})) headers.set(name, value);
      headers.set(FAKE_VECTOR_HEADER, vector.name);
      return fetch(input, { ...init, headers });
    },
  });
}

const KIND_BY_STATUS: Record<number, string> = { 200: "ready", 401: "signedOut", 403: "notTeacher" };
const vectorsOf = (route: string) => VECTORS.filter((v) => v.route === route);

describe("readTeacherCourses over every vector of teacher.courses.get", () => {
  const vectors = vectorsOf("teacher.courses.get");
  it("has vectors for 200, 401, 403 and the rest", () => {
    expect(new Set(vectors.map((v) => v.response.status))).toEqual(new Set([200, 401, 403, 404, 503]));
  });
  for (const vector of vectors) {
    it(`${vector.name}: one request, ${KIND_BY_STATUS[vector.response.status] ?? "unavailable"}`, async () => {
      const sent = { count: 0 };
      const read = await readTeacherCourses(over(vector, sent) as unknown as TeacherCoursesCall);
      expect(sent.count).toBe(1);
      expect(read.kind).toBe(KIND_BY_STATUS[vector.response.status] ?? "unavailable");
      if (read.kind === "ready") expect(read.courses).toEqual((vector.response.body as { courses: unknown[] }).courses);
    });
  }
});

describe("readMentoredWorks over every vector of teacher.mentorships.get", () => {
  const vectors = vectorsOf("teacher.mentorships.get");
  it("has vectors for 200, 401, 403 and the rest", () => {
    expect(new Set(vectors.map((v) => v.response.status))).toEqual(new Set([200, 401, 403, 503]));
  });
  for (const vector of vectors) {
    it(`${vector.name}: one request, ${KIND_BY_STATUS[vector.response.status] ?? "unavailable"}`, async () => {
      const sent = { count: 0 };
      const read = await readMentoredWorks(over(vector, sent) as unknown as MentoredWorksCall);
      expect(sent.count).toBe(1);
      expect(read.kind).toBe(KIND_BY_STATUS[vector.response.status] ?? "unavailable");
      if (read.kind === "ready") expect(read.works).toEqual((vector.response.body as { works: unknown[] }).works);
    });
  }
});

describe("a broken connection or an answer outside the schema", () => {
  const json = (status: number, body: unknown) => async () =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  it("reads unavailable, never an empty list", async () => {
    const broken = createApi({ baseUrl: "http://127.0.0.1:1", fetchImpl: () => Promise.reject(new TypeError("Failed to fetch")) });
    expect(await readTeacherCourses(broken as unknown as TeacherCoursesCall)).toEqual({ kind: "unavailable" });
    expect(await readMentoredWorks(broken as unknown as MentoredWorksCall)).toEqual({ kind: "unavailable" });
    const wide = createApi({ baseUrl: "http://127.0.0.1:1", fetchImpl: json(200, { courses: [], extra: 1 }) });
    expect(await readTeacherCourses(wide as unknown as TeacherCoursesCall)).toEqual({ kind: "unavailable" });
    const wrong = createApi({ baseUrl: "http://127.0.0.1:1", fetchImpl: json(200, { works: [{ title: "x" }] }) });
    expect(await readMentoredWorks(wrong as unknown as MentoredWorksCall)).toEqual({ kind: "unavailable" });
  });
});

// WEB-30 (N-04, N-07, N-17): the reads that wait for contract 3.2.0
// (TODO(ugovor)) over invented answers; the receipt is the vector's.
describe("WEB-30 teacher reads (TODO(ugovor))", () => {
  const RECEIPT = (VECTORS.find((v) => v.route === "submission.submit.post" && v.name === "submitted")?.response.body as {
    receipt: SubmissionReceipt;
  }).receipt;
  const ASSIGNMENT = RECEIPT.payload.assignmentId;
  const STUDENT = "0b6f1c2e-4a5d-4e8f-9a1b-2c3d4e5f6a7b";
  const OTHER = "1c7a2d3f-5b6e-4f90-8b2c-3d4e5f6a7b8c";
  const answer = (status: number, body: unknown, calls: Parameters<TeacherCall>[] = []): TeacherCall => async (...call) => {
    calls.push(call);
    return status < 400 ? { ok: true, status, body } : { ok: false, status, code: "x" };
  };
  const student = { studentId: STUDENT, name: "Ana Izmišljena", group: "A", works: [{ assignmentId: ASSIGNMENT, state: "predano" }] };
  const row = {
    studentId: STUDENT, name: "Ana Izmišljena", group: "A", submitted: true, requestedMinute: "2026-11-02T09:15Z",
    afterDeadline: false, evidenceRecord: "continuous",
  };
  const notSubmitted = { ...row, studentId: OTHER, name: null, group: "B", submitted: false, requestedMinute: null, evidenceRecord: null };

  it("course students: one call with the course id, the list as given, a missing name stays null", async () => {
    const calls: Parameters<TeacherCall>[] = [];
    const nameless = { ...student, studentId: OTHER, name: null, group: null, works: [] };
    const read = await readCourseStudents(answer(200, { students: [student, nameless] }, calls), "c-1");
    expect(calls).toEqual([["teacher.course-students.get", { params: { courseId: "c-1" } }]]);
    expect(read).toEqual({ kind: "ready", students: [student, nameless] });
    expect(await readCourseStudents(answer(200, { students: [] }), "tuđi")).toEqual({ kind: "ready", students: [] });
  });

  it("assignment overview: submitted, after the deadline and not submitted rows", async () => {
    const late = { ...row, studentId: OTHER, afterDeadline: true, evidenceRecord: "with_gaps" };
    const calls: Parameters<TeacherCall>[] = [];
    expect(await readAssignmentOverview(answer(200, { rows: [row, late] }, calls), ASSIGNMENT)).toEqual({ kind: "ready", rows: [row, late] });
    expect(calls).toEqual([["teacher.assignment-overview.get", { params: { assignmentId: ASSIGNMENT } }]]);
    expect(await readAssignmentOverview(answer(200, { rows: [row, notSubmitted] }), ASSIGNMENT)).toEqual({ kind: "ready", rows: [row, notSubmitted] });
    const leap = { ...row, requestedMinute: "2028-02-29T23:59Z" };
    expect(await readAssignmentOverview(answer(200, { rows: [leap] }), ASSIGNMENT)).toEqual({ kind: "ready", rows: [leap] });
    const ceka = { ...row, evidenceRecord: null };
    expect(await readAssignmentOverview(answer(200, { rows: [ceka] }), ASSIGNMENT)).toEqual({ kind: "ready", rows: [ceka] });
  });

  it("overview accepts an optional documentId and still works without it", async () => {
    const withId = { ...row, documentId: "izmisljeni-rad-0001" };
    expect(await readAssignmentOverview(answer(200, { rows: [withId] }), ASSIGNMENT)).toEqual({ kind: "ready", rows: [withId] });
    expect(await readAssignmentOverview(answer(200, { rows: [row] }), ASSIGNMENT)).toEqual({ kind: "ready", rows: [row] });
    expect(await readAssignmentOverview(answer(200, { rows: [{ ...row, documentId: "" }] }), ASSIGNMENT)).toEqual({ kind: "nepoznato" });
  });

  const nepoznato = { kind: "nepoznato" };
  it.each([
    ["an unknown field on the list", { students: [student], extra: 1 }],
    ["an unknown field on a student", { students: [{ ...student, email: "ana@example.invalid" }] }],
    ["an unknown work state", { students: [{ ...student, works: [{ assignmentId: ASSIGNMENT, state: "spremljeno" }] }] }],
    ["an empty name instead of null", { students: [{ ...student, name: "" }] }],
    ["the same student twice", { students: [student, student] }],
    ["one assignment twice with two states", {
      students: [{ ...student, works: [{ assignmentId: ASSIGNMENT, state: "predano" }, { assignmentId: ASSIGNMENT, state: "nije_predano" }] }],
    }],
  ])("course students with %s is nepoznato, never shown", async (_name, body) => {
    expect(await readCourseStudents(answer(200, body), "c-1")).toEqual(nepoznato);
  });

  it.each([
    ["a submission hash", { rows: [{ ...row, artifactSha256: "a".repeat(64) }] }],
    ["a submission id", { rows: [{ ...row, submissionId: STUDENT }] }],
    ["the text", { rows: [{ ...row, text: "izmišljeni tekst" }] }],
    ["a time with seconds", { rows: [{ ...row, requestedMinute: "2026-11-02T09:15:00Z" }] }],
    ["a date that does not exist", { rows: [{ ...row, requestedMinute: "2026-11-31T09:15Z" }] }],
    ["29 February of a common year", { rows: [{ ...row, requestedMinute: "2026-02-29T09:15Z" }] }],
    ["month 13", { rows: [{ ...row, requestedMinute: "2026-13-01T09:15Z" }] }],
    ["hour 24", { rows: [{ ...row, requestedMinute: "2026-11-02T24:00Z" }] }],
    ["minute 60", { rows: [{ ...row, requestedMinute: "2026-11-02T09:60Z" }] }],
    ["a time on a work not submitted", { rows: [{ ...notSubmitted, requestedMinute: "2026-11-02T09:15Z" }] }],
    ["a record on a work not submitted", { rows: [{ ...notSubmitted, evidenceRecord: "continuous" }] }],
    ["after the deadline but not submitted", { rows: [{ ...notSubmitted, afterDeadline: true }] }],
    ["submitted without a time", { rows: [{ ...row, requestedMinute: null }] }],
    ["an unknown record", { rows: [{ ...row, evidenceRecord: "partial" }] }],
  ])("assignment overview with %s is nepoznato, never shown", async (_name, body) => {
    expect(await readAssignmentOverview(answer(200, body), ASSIGNMENT)).toEqual(nepoznato);
  });

  it.each([
    [401, { kind: "session-expired" }],
    [403, nepoznato],
    [404, nepoznato],
    [408, nepoznato],
    [503, nepoznato],
  ])("a %i on the lists reads %o, never an empty list", async (status, expected) => {
    expect(await readCourseStudents(answer(status, null), "c-1")).toEqual(expected);
    expect(await readAssignmentOverview(answer(status, null), ASSIGNMENT)).toEqual(expected);
  });

  it("a 201 or a broken connection is nepoznato", async () => {
    expect(await readCourseStudents(answer(201, { students: [] }), "c-1")).toEqual(nepoznato);
    const broken: TeacherCall = () => Promise.reject(new TypeError("Failed to fetch"));
    expect(await readCourseStudents(broken, "c-1")).toEqual(nepoznato);
    expect(await readAssignmentOverview(broken, ASSIGNMENT)).toEqual(nepoznato);
    expect(await readTeacherReceipt(broken, ASSIGNMENT, STUDENT)).toEqual(nepoznato);
  });

  it("the receipt: the student's shape and check over the teacher's route (rule 5)", async () => {
    const calls: Parameters<TeacherCall>[] = [];
    const teacher = await readTeacherReceipt(answer(200, { state: "potvrdeno", receipt: RECEIPT }, calls), ASSIGNMENT, STUDENT);
    expect(calls).toEqual([["teacher.submission-receipt.get", { params: { assignmentId: ASSIGNMENT, studentId: STUDENT } }]]);
    const student = await readSubmissionState(async () => ({ ok: true, status: 200, body: { state: "potvrdeno", receipt: RECEIPT } }), ASSIGNMENT);
    expect(teacher).toEqual({ kind: "potvrdeno", receipt: RECEIPT });
    expect(teacher).toEqual(student);
    expect(await readTeacherReceipt(answer(200, { state: "none" }), ASSIGNMENT, STUDENT)).toEqual({ kind: "none" });
    const ceka = { state: "ceka", revision: 3, requestedAt: "2026-11-02T09:15:42.123456Z" };
    expect(await readTeacherReceipt(answer(200, ceka), ASSIGNMENT, STUDENT)).toEqual({ kind: "ceka", revision: 3, requestedAt: ceka.requestedAt });
  });

  it.each([
    ["an unknown field on the receipt", { state: "potvrdeno", receipt: { ...RECEIPT, seen: true } }],
    ["an unknown field on the payload", { state: "potvrdeno", receipt: { ...RECEIPT, payload: { ...RECEIPT.payload, teacher: STUDENT } } }],
    ["an unknown field on the answer", { state: "potvrdeno", receipt: RECEIPT, viewedBy: STUDENT }],
    ["a receipt without a signature", { state: "potvrdeno", receipt: { ...RECEIPT, signature: undefined } }],
    ["a receipt of another assignment", { state: "potvrdeno", receipt: { ...RECEIPT, payload: { ...RECEIPT.payload, assignmentId: OTHER } } }],
  ])("the receipt with %s is nepoznato, never shown", async (_name, body) => {
    expect(await readTeacherReceipt(answer(200, JSON.parse(JSON.stringify(body))), ASSIGNMENT, STUDENT)).toEqual(nepoznato);
  });

  it("the receipt of another teacher's student is the student's 404", async () => {
    expect(await readTeacherReceipt(answer(404, null), ASSIGNMENT, STUDENT)).toEqual({ kind: "greska", code: "not_found" });
    expect(await readTeacherReceipt(answer(401, null), ASSIGNMENT, STUDENT)).toEqual({ kind: "session-expired" });
  });
});
