// WEB-NUZ-NZ NZ-2 and NZ-10: the N-17 port over createApi with a stand-in transport. One course or all,
// the rows joined with the course's students, the submissions and the extensions; invented data only.
import { describe, expect, it } from "vitest";

import { createApi } from "../../../../../src/client/api";
import { overviewPort } from "./overview";
import type { N17Card } from "./n17/model";

const K1 = "00000000-0000-4000-8000-0000000000c1";
const K2 = "00000000-0000-4000-8000-0000000000c2";
const A1 = "00000000-0000-4000-8000-0000000000a1";
const A2 = "00000000-0000-4000-8000-0000000000a2";
const S1 = "00000000-0000-4000-8000-0000000000b1";
const S2 = "00000000-0000-4000-8000-0000000000b2";
const task = (id: string, title: string) => ({
  id, title, workType: "seminar_paper", opensAt: "2026-10-01T08:00:00.000Z", dueAt: "2026-12-15T22:59:00.000Z", currentVersion: 1, enrolledStudents: 2,
});
const COURSES = {
  courses: [
    { id: K1, name: "Izmišljeni kolegij A", academicYear: "2026/2027", aiPolicy: "partially_allowed", assignments: [task(A1, "Kućno kompostiranje")] },
    { id: K2, name: "Izmišljeni kolegij B", academicYear: "2026/2027", aiPolicy: "partially_allowed", assignments: [task(A2, "Prikaz članka")] },
  ],
};
const person = (studentId: string, given: string) => ({ studentId, givenName: given, familyName: "Izmišljenić", groupName: null });
const ANSWERS: Record<string, unknown> = {
  "/teacher/courses": COURSES,
  [`/teacher/courses/${K1}/students`]: { students: [
    { ...person(S1, "Ana"), assignments: [{ assignmentId: A1, documentId: "doc-1", workState: "submitted" }] },
    { ...person(S2, "Iva"), assignments: [{ assignmentId: A1, documentId: "doc-2", workState: "in_progress" }] },
  ] },
  [`/teacher/assignments/${A1}/overview`]: { students: [
    { ...person(S1, "Ana"), submitted: true, requestedMinute: "2026-11-05T20:14:00.000Z", afterDeadline: false, evidenceRecord: "continuous" },
    { ...person(S2, "Iva"), submitted: false, requestedMinute: null, afterDeadline: null, evidenceRecord: null },
  ] },
  [`/teacher/assignments/${A1}/submissions`]: { submissions: [
    { studentId: S1, documentId: "doc-1", submitted: true, revision: 3, requestedMinute: "2026-11-05T20:14:00.000Z", afterDeadline: false },
  ] },
  [`/teacher/assignments/${A1}/deadline-extensions`]: { extensions: [] },
  [`/courses/${K1}/team/view`]: { role: "holder", holderId: S2, assistants: [], students: [], groups: [] },
  [`/courses/${K1}/team`]: { holderId: S2, assistantIds: [] },
  [`/courses/${K1}/team/candidates`]: { candidates: [] },
};

function client(answers: Record<string, unknown>, asked: string[] = []) {
  return () => createApi({
    baseUrl: "http://127.0.0.1:1",
    fetchImpl: async (input) => {
      const path = new URL(String(input instanceof Request ? input.url : input)).pathname.replace(/^\/api\/v1/, "");
      asked.push(path);
      const body = answers[path];
      return body === undefined
        ? new Response(JSON.stringify({ code: "unavailable" }), { status: 503, headers: { "content-type": "application/json" } })
        : new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
}

describe("N-17 overview port (NZ-2, NZ-10)", () => {
  it("reads only the course of `?kolegij=` and joins the version, the state and the document", async () => {
    const asked: string[] = [];
    const read = await overviewPort({ course: K1, task: null }, client(ANSWERS, asked)).read();
    expect(read.kind).toBe("ready");
    if (read.kind !== "ready") return;
    expect(read.course).toBe("Izmišljeni kolegij A");
    expect(read.cards.map((c) => c.assignmentId)).toEqual([A1]);
    expect(asked.some((p) => p.includes(A2) || p.includes(K2))).toBe(false);
    const [ana, iva] = read.cards[0]!.rows!;
    expect(ana).toMatchObject({ studentId: S1, submitted: true, version: 3, documentId: "doc-1", deadlineExtended: false });
    expect(iva).toMatchObject({ studentId: S2, phase: "writing", documentId: "doc-2", dueAt: "2026-12-15T22:59:00.000Z" });
    expect(read.cards[0]).toMatchObject({ courseId: K1, dueAt: "2026-12-15T22:59:00.000Z", role: "holder" });
  });
  it("an unknown course shows every course, and a failed overview fails only its card", async () => {
    const read = await overviewPort({ course: "nepostojeci", task: null }, client(ANSWERS)).read();
    if (read.kind !== "ready") throw new Error(read.kind);
    expect(read.course).toBeUndefined();
    const cards: readonly N17Card[] = read.cards;
    expect(cards.map((c) => [c.assignmentId, c.rows === null])).toEqual([[A1, false], [A2, true]]);
    // The team view of K2 does not answer: its role is unknown, so N-17 offers it no entry that writes.
    expect(cards.map((c) => c.role)).toEqual(["holder", "unknown"]);
  });
  it("a failed join leaves the rows as the overview says them", async () => {
    const only = { "/teacher/courses": COURSES, [`/teacher/assignments/${A1}/overview`]: ANSWERS[`/teacher/assignments/${A1}/overview`] };
    const read = await overviewPort({ course: K1, task: null }, client(only)).read();
    if (read.kind !== "ready") throw new Error(read.kind);
    const [ana, iva] = read.cards[0]!.rows!;
    expect(ana!.version).toBeUndefined();
    expect(iva!.phase).toBeUndefined();
    expect(iva!.dueAt).toBeUndefined();
  });
  it("`?zadatak=` without `?kolegij=` shows only that assignment and reads no other course", async () => {
    const asked: string[] = [];
    const read = await overviewPort({ course: null, task: A1 }, client(ANSWERS, asked)).read();
    if (read.kind !== "ready") throw new Error(read.kind);
    expect(read.course).toBeUndefined();
    expect(read.cards.map((c) => [c.courseId, c.assignmentId])).toEqual([[K1, A1]]);
    expect(asked.some((p) => p.includes(A2) || p.includes(K2))).toBe(false);
  });
  it("an assignment no course has (a stale link) shows every assignment, never an empty overview", async () => {
    const read = await overviewPort({ course: null, task: "nepostojeci" }, client(ANSWERS)).read();
    if (read.kind !== "ready") throw new Error(read.kind);
    expect(read.cards.map((c) => c.assignmentId)).toEqual([A1, A2]);
  });
  it("a failed course read is unavailable, never an empty overview", async () => {
    expect(await overviewPort({ course: null, task: null }, client({})).read()).toEqual({ kind: "unavailable" });
  });
});
