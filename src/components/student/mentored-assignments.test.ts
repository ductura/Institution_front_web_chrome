// INT-31: the mentored works join the course list as one more group, and a
// failed mentored read never leaves a list that may lack a work.
import { describe, expect, it } from "vitest";

import { editorWorkRead } from "../editor/EditorPage.read";
import { MENTORED_GROUP_ID, readAssignmentsWithMentored, withMentored, withMentoredAssignments, withMentoredCall, type AssignmentsApi } from "./mentored-assignments";

const COURSE = "00000000-0000-4000-8000-0000000000c1";
const ESSAY = "00000000-0000-4000-8000-0000000000a1";
const THESIS = "00000000-0000-4000-8000-0000000000b1";

const courses = {
  ok: true as const,
  status: 200 as const,
  headers: {},
  body: { courses: [{ id: COURSE, name: "Izmišljeni kolegij", assignments: [{ id: ESSAY, title: "Esej", dueAt: "2027-01-10T10:00:00Z", noticeFirst: false }] }] },
};
const thesis = {
  id: THESIS,
  mentorshipId: "00000000-0000-4000-8000-0000000000d1",
  title: "Izmišljeni diplomski rad",
  dueAt: "2027-06-30T10:00:00Z",
  noticeFirst: false,
  workType: "master_thesis" as const,
  mentor: { id: "00000000-0000-4000-8000-000000000102", givenName: "Marko", familyName: "Izmišljeni" },
  extendedDueAt: null,
};
const mentored = (list: (typeof thesis)[]) => ({ ok: true as const, status: 200 as const, headers: {}, body: { assignments: list } });
const failed = (status: number, code: string) => ({ ok: false as const, status, code }) as never;

describe("withMentored", () => {
  it("adds the mentored works as a group after the courses, without the mentorship id", () => {
    const result = withMentored(courses, mentored([thesis]));
    expect(result.ok && result.body.courses.map((c) => c.id)).toEqual([COURSE, MENTORED_GROUP_ID]);
    expect(result.ok && result.body.courses[1]).toEqual({
      id: MENTORED_GROUP_ID,
      name: "Radovi uz mentora",
      assignments: [{ id: THESIS, title: thesis.title, dueAt: thesis.dueAt, noticeFirst: false, workType: "master_thesis", mentor: thesis.mentor, extendedDueAt: null }],
    });
  });

  it("adds no empty group", () => {
    expect(withMentored(courses, mentored([]))).toEqual(courses);
  });

  it("keeps a failed course read as it came", () => {
    const signedOut = failed(401, "unauthorized");
    expect(withMentored(signedOut, mentored([thesis]))).toBe(signedOut);
  });

  it("fails the whole answer with the mentored read's status and code, never a list without the work", () => {
    expect(withMentored(courses, failed(401, "session_expired"))).toEqual({ ok: false, status: 401, code: "session_expired" });
    expect(withMentored(courses, failed(503, "unavailable"))).toEqual({ ok: false, status: 503, code: "unavailable" });
    expect(withMentored(courses, failed(0, "unexpected"))).toEqual({ ok: false, status: 0, code: "unexpected" });
  });

  it("leaves the course list as it is when the server has no mentored route yet (404)", () => {
    expect(withMentored(courses, failed(404, "unexpected"))).toEqual(courses);
  });

  it("lets the editor page find the thesis, which it reported as not found before", () => {
    const work = { ok: true as const, status: 200, body: { assignments: [{ assignmentId: THESIS, workState: "in_progress" }] } };
    expect(editorWorkRead(THESIS, courses, work)).toEqual({ kind: "notFound" });
    expect(editorWorkRead(THESIS, withMentored(courses, mentored([thesis])), work)).toEqual({
      kind: "ready",
      course: "Radovi uz mentora",
      title: thesis.title,
      dueAt: thesis.dueAt,
      workState: "in_progress",
      workType: "master_thesis",
    });
  });
});

describe("readAssignmentsWithMentored", () => {
  it("reads both routes once each and turns a thrown call into status 0", async () => {
    const seen: string[] = [];
    const api = (async (id: string) => {
      seen.push(id);
      if (id === "student.mentored-assignments.get") throw new Error("offline");
      return courses;
    }) as unknown as AssignmentsApi;
    expect(await readAssignmentsWithMentored(api)).toEqual({ ok: false, status: 0, code: "unexpected" });
    expect(seen.sort()).toEqual(["student.assignments.get", "student.mentored-assignments.get"]);
  });

  it("serves readMyAssignments as its one-route call", async () => {
    const api = (async (id: string) => (id === "student.assignments.get" ? courses : mentored([thesis]))) as unknown as AssignmentsApi;
    const result = await withMentoredCall(api)("student.assignments.get", { params: undefined, query: undefined, body: undefined });
    expect(result.ok && result.body.courses.at(-1)?.assignments.map((a) => a.id)).toEqual([THESIS]);
  });
});

describe("withMentoredAssignments", () => {
  it("adds the mentored works to student.assignments.get and forwards every other route as it was", async () => {
    const seen: string[] = [];
    const work = { ok: true as const, status: 200 as const, body: { assignments: [] } };
    const client = async (id: string, _input: unknown) => {
      seen.push(id);
      return id === "student.assignments.get" ? courses : id === "student.mentored-assignments.get" ? mentored([thesis]) : work;
    };
    const wrapped = withMentoredAssignments(client as (id: never, input: never) => Promise<unknown>) as unknown as typeof client;
    const result = (await wrapped("student.assignments.get", {})) as typeof courses;
    expect(result.body.courses.map((c) => c.id)).toEqual([COURSE, MENTORED_GROUP_ID]);
    expect(await wrapped("student.assignment-work.get", {})).toBe(work);
    expect(seen.sort()).toEqual(["student.assignment-work.get", "student.assignments.get", "student.mentored-assignments.get"]);
  });
});
