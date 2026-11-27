import { describe, expect, it, vi } from "vitest";

import { readMyAssignments, type AssignmentsCall, type MyCourse } from "./my-assignments-read";

// Ductura reads the list through student.assignments.get (DAN-876), not the
// Ductus RLS read: the server groups, orders and checks the rows, and
// createApi() checks the answer against the schema. What stays here is the
// contract of the read itself: a list only from a 200, never an empty or older
// list in its place. All names below are invented.
const C1 = "11111111-1111-4111-8111-111111111111";
const C2 = "22222222-2222-4222-8222-222222222222";
const A1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const A2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const COURSES: MyCourse[] = [
  { id: C2, name: "Arhivi", assignments: [{ id: A2, title: "Treći", dueAt: "2026-11-30T22:59:00.000Z", noticeFirst: true }] },
  { id: C1, name: "Čitanje izmišljenih izvora", assignments: [{ id: A1, title: "Izmišljeni esej", dueAt: "2026-12-15T10:00:00.000Z", noticeFirst: false }] },
];

type Answer = Awaited<ReturnType<AssignmentsCall>>;

function api(answer: Answer | Error) {
  const call = vi.fn<AssignmentsCall>(async () => {
    if (answer instanceof Error) throw answer;
    return answer;
  });
  return call;
}

describe("readMyAssignments", () => {
  it("makes exactly one call of student.assignments.get with no input", async () => {
    const call = api({ ok: true, status: 200, body: { courses: COURSES } });
    await readMyAssignments(call);
    expect(call).toHaveBeenCalledTimes(1);
    expect(call).toHaveBeenCalledWith("student.assignments.get", { params: undefined, query: undefined, body: undefined });
  });

  it("gives the list of a 200 as it came, in the server's order", async () => {
    expect(await readMyAssignments(api({ ok: true, status: 200, body: { courses: COURSES } }))).toEqual({ kind: "ready", courses: COURSES });
  });

  it("keeps an empty list of a 200 as an empty list, not as unavailable", async () => {
    expect(await readMyAssignments(api({ ok: true, status: 200, body: { courses: [] } }))).toEqual({ kind: "ready", courses: [] });
  });

  it("reads a 401 as signed out", async () => {
    expect(await readMyAssignments(api({ ok: false, status: 401, code: "unauthenticated" }))).toEqual({ kind: "signedOut" });
    expect(await readMyAssignments(api({ ok: false, status: 401, code: "session_expired" }))).toEqual({ kind: "signedOut" });
  });

  // Design alignment 27. 11. 2026.: 403 is no access, its own state, not a read error.
  it("reads a 403 as denied", async () => {
    expect(await readMyAssignments(api({ ok: false, status: 403, code: "forbidden" }))).toEqual({ kind: "denied" });
  });

  it("gives no list at all for any other answer or a failed call", async () => {
    for (const status of [400, 404, 409, 429, 500, 502, 503]) {
      expect(await readMyAssignments(api({ ok: false, status, code: "unexpected" })), String(status)).toEqual({ kind: "unavailable" });
    }
    expect(await readMyAssignments(api(new TypeError("made-up broken connection")))).toEqual({ kind: "unavailable" });
    const rejected = vi.fn<AssignmentsCall>(() => Promise.reject(new Error("made-up failure")));
    expect(await readMyAssignments(rejected)).toEqual({ kind: "unavailable" });
  });
});
