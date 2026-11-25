// WEB-2113: the tests of src/components/student/upis/course-read.test.ts for the host's own copy.
import { describe, expect, it, vi } from "vitest";

import { createApi } from "@/client/api";

import { courseHref, noticeHref, pickOpenAssignment, readCourse } from "./course-read";

const COURSE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OTHER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const K = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const Z = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const NOW = new Date("2026-11-19T12:00:00Z");
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const apiWith = (reply: () => Response) =>
  createApi({ baseUrl: "http://web.test", fetchImpl: vi.fn(async () => reply()) as unknown as typeof fetch });
const assignment = (id: string, dueAt: string, extendedDueAt: string | null = null) =>
  ({ id, title: "Seminarski rad: kućno kompostiranje", dueAt, noticeFirst: true, extendedDueAt });

describe("WEB-11 the course after the enrollment", () => {
  it("picks the nearest assignment not yet past due, counting an extension", () => {
    expect(pickOpenAssignment([
      { id: "b", dueAt: "2026-12-20T12:00:00Z" },
      { id: "a", dueAt: "2026-11-01T12:00:00Z" },
      { id: "c", dueAt: "2026-11-10T12:00:00Z", extendedDueAt: "2026-12-01T12:00:00Z" },
    ], NOW)).toBe("c");
    expect(pickOpenAssignment([{ id: "a", dueAt: "2026-11-01T12:00:00Z" }], NOW)).toBeNull();
    expect(pickOpenAssignment([{ id: "y", dueAt: "2026-12-01T12:00:00Z" }, { id: "x", dueAt: "2026-12-01T12:00:00Z" }], NOW)).toBe("x");
  });

  it("goes to the notice of the course's open assignment", async () => {
    const api = apiWith(() => json({ courses: [
      { id: OTHER, name: "Drugi izmišljeni kolegij", assignments: [assignment(Z, "2026-12-02T12:00:00.000Z")] },
      { id: COURSE, name: "Izmišljeni seminar iz ekologije grada", assignments: [assignment(K, "2026-12-15T12:00:00.000Z")] },
    ] }));
    expect(await readCourse(api, COURSE, NOW)).toEqual({ kind: "assignment", assignmentId: K });
  });

  it("tells a course without an open assignment from one the student is not in", async () => {
    const api = apiWith(() => json({ courses: [{ id: COURSE, name: "Izmišljeni kolegij", assignments: [] }] }));
    expect(await readCourse(api, COURSE, NOW)).toEqual({ kind: "none" });
    expect(await readCourse(api, OTHER, NOW)).toEqual({ kind: "notFound" });
  });

  it("reads 401 as signed out and anything else as unavailable", async () => {
    expect(await readCourse(apiWith(() => json({ error: "unauthorized" }, 401)), COURSE)).toEqual({ kind: "signedOut" });
    expect(await readCourse(apiWith(() => json({ error: "unavailable" }, 503)), COURSE)).toEqual({ kind: "unavailable" });
    expect(await readCourse(apiWith(() => json({ courses: "x" })), COURSE)).toEqual({ kind: "unavailable" });
  });

  it("encodes the paths it builds", () => {
    expect(courseHref("a/b")).toBe("/upis/kolegij/a%2Fb");
    expect(noticeHref("a?b")).toBe("/zadatak/a%3Fb");
  });
});
