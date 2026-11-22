import { describe, expect, it } from "vitest";

import { effectiveDue, groupLabels, mentorLabel, nearTag, rowKind, workTypeLabel } from "./model";
import { readCourses, type CoursesCall } from "./read";

const NOW = new Date("2026-11-22T10:00:00Z");

describe("E-3/E-4 model", () => {
  it("labels seminar groups", () => {
    expect(groupLabels([{ id: "1", name: "2" }, { id: "2", name: "Seminarska grupa 4" }])).toEqual(["Seminarska grupa 2", "Seminarska grupa 4"]);
    expect(groupLabels(undefined)).toEqual([]);
  });
  it("names work type and mentor, or nothing", () => {
    expect(workTypeLabel("essay")).toBe("Esej");
    expect(workTypeLabel("nepoznato")).toBeNull();
    expect(mentorLabel({ id: "m", givenName: "Iva", familyName: "Izmišljenić" })).toBe("Mentor: Iva Izmišljenić");
    expect(mentorLabel(null)).toBeNull();
  });
  it("picks the row kind in the order submitted, notice, work, task", () => {
    expect(rowKind(true, "submitted")).toBe("submitted");
    expect(rowKind(true, "in_progress")).toBe("notice");
    expect(rowKind(false, "in_progress")).toBe("work");
    expect(rowKind(false, null)).toBe("task");
  });
  it("tags near deadlines only", () => {
    expect(nearTag("2026-11-25T10:00:00Z", NOW)).toBe("Rok za 3 dana");
    expect(nearTag("2026-11-23T08:00:00Z", NOW)).toBe("Rok je danas");
    expect(nearTag("2026-12-30T10:00:00Z", NOW)).toBeNull();
    expect(nearTag("2026-11-20T10:00:00Z", NOW)).toBeNull();
  });
  it("lets an extension replace the deadline", () => {
    expect(effectiveDue("a", "b")).toBe("b");
    expect(effectiveDue("a", null)).toBe("a");
  });
});

describe("readCourses", () => {
  const ok = { ok: true, status: 200, body: { courses: [] } };
  it("is unavailable, never empty, when the read fails", async () => {
    expect(await readCourses((async () => ({ ok: false, status: 500 })) as unknown as CoursesCall, false)).toEqual({ kind: "unavailable" });
    expect(await readCourses((async () => { throw new Error("x"); }) as unknown as CoursesCall, false)).toEqual({ kind: "unavailable" });
  });
  it("maps 401 to signed out", async () => {
    expect(await readCourses((async () => ({ ok: false, status: 401 })) as unknown as CoursesCall, true)).toEqual({ kind: "signedOut" });
  });
  it("keeps courses without states when the state read fails", async () => {
    const call = (async (id: string) => (id === "student.assignments.get" ? ok : { ok: false, status: 404 })) as unknown as CoursesCall;
    expect(await readCourses(call, true)).toEqual({ kind: "ready", courses: [], states: null });
  });
});
