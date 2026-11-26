import { describe, expect, it } from "vitest";

import { readHomeExtras, type CoursesCall, type Course } from "../courses/read";

const courses: Course[] = [{ id: "c1", name: "Kolegij A", assignments: [
  { id: "a1", title: "Prvi", dueAt: "2026-11-23T10:00:00Z", noticeFirst: false },
  { id: "a2", title: "Drugi", dueAt: "2026-12-30T10:00:00Z", noticeFirst: false, extendedDueAt: "2027-01-10T10:00:00Z" },
  { id: "a3", title: "Treći", dueAt: "2026-12-30T10:00:00Z", noticeFirst: false },
] }];
const states = new Map([["a1", "submitted" as const], ["a3", "in_progress" as const]]);
const list = { ok: true, status: 200, body: { assignments: [
  { assignmentId: "a1", submittedAt: "2026-11-21T09:00:00Z", afterDeadline: false },
  { assignmentId: "a3", submittedAt: "2026-11-21T09:00:00Z", afterDeadline: false },
] } };
const history = { ok: true, body: { extensions: [{ dueAt: "2027-01-10T10:00:00Z", previousDueAt: "2026-12-30T10:00:00Z", scope: "all", reasonId: null, createdAt: "2026-11-19T10:00:00Z" }] } };

describe("readHomeExtras", () => {
  it("asks the submissions once for the list and the history only for the extended assignment", async () => {
    const asked: string[] = [];
    const call = (async (id: string) => { asked.push(id); return list; }) as unknown as CoursesCall;
    const asks: string[] = [];
    const result = await readHomeExtras(call, async (id) => { asks.push(id); return history; }, courses, states);
    expect(asked).toEqual(["student.assignment-submissions.get"]);
    expect(asks).toEqual(["a2"]);
    expect([...result.submitted.keys()]).toEqual(["a1"]); // a3 is not proven submitted by the states
    expect(result.extensions.get("a2")?.scope).toBe("all");
  });

  it("leaves both halves empty when the reads fail, and skips the times without proven states", async () => {
    const call = (async () => { throw new Error("down"); }) as unknown as CoursesCall;
    const result = await readHomeExtras(call, async () => ({ ok: false }), courses, null);
    expect(result.submitted.size).toBe(0);
    expect(result.extensions.size).toBe(0);
  });
});
