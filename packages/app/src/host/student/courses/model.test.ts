import { describe, expect, it } from "vitest";

import { deadlineTagOf, effectiveDue, extensionOf, extensionText, groupLabels, matchesState, mentorLabel, nearTag, practiceOf, rowKind, stateFilterOf, submittedLine, submittedOf, workMeta, workTypeLabel, yearLabel } from "./model";
import { coursesText } from "./messages.hr";
import { homeText } from "../home/messages.hr";
import { nearTag as homeNearTag } from "../home/model";
import { readCourses, readExtensions, type Course, type CoursesCall } from "./read";

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
  it("joins work kind and mentor for E-3, and says nothing for what the answer lacks (STU-R14)", () => {
    const mentor = { id: "m", givenName: "Iva", familyName: "Izmišljenić" };
    expect(workMeta({ workType: "essay", mentor })).toBe("Esej · Mentor: Iva Izmišljenić");
    expect(workMeta({ workType: "essay", mentor: null })).toBe("Esej");
    expect(workMeta({ mentor })).toBe("Mentor: Iva Izmišljenić");
    expect(workMeta({ workType: "nepoznato" })).toBeNull();
    expect(workMeta({})).toBeNull();
  });
  it("picks the row kind in the order submitted, notice, work, task", () => {
    expect(rowKind(true, "submitted")).toBe("submitted");
    expect(rowKind(true, "in_progress")).toBe("notice");
    expect(rowKind(false, "in_progress")).toBe("work");
    expect(rowKind(false, null)).toBe("task");
  });
  it("tags near deadlines only", () => {
    expect(nearTag("2026-11-25T10:00:00Z", NOW)).toBe("Rok za 3 dana");
    // PAR2-A3: 22 h ahead is tomorrow in Zagreb, so not "danas" (E-2 said "Rok za 1 dan" for the same row).
    expect(nearTag("2026-11-23T08:00:00Z", NOW)).toBe("Rok za 1 dan");
    expect(nearTag("2026-12-30T10:00:00Z", NOW)).toBeNull();
    expect(nearTag("2026-11-20T10:00:00Z", NOW)).toBeNull();
  });
  it("says Rok je danas only for a deadline on today's Zagreb date, for a Date or epoch now (PAR2-A3)", () => {
    expect(nearTag("2026-11-22T22:59:00Z", NOW)).toBe("Rok je danas");
    expect(nearTag("2026-11-22T22:59:00Z", NOW.getTime())).toBe("Rok je danas");
    // 23:30 UTC on the 22nd is already the 23rd in Zagreb (UTC+1).
    expect(nearTag("2026-11-22T23:30:00Z", NOW)).toBe("Rok za 1 dan");
    expect(nearTag("2026-11-22T10:00:00Z", NOW)).toBe("Rok je danas");
    expect(nearTag("2026-11-29T10:00:00Z", NOW)).toBe("Rok za 7 dana");
    expect(nearTag("2026-11-29T10:00:01Z", NOW)).toBeNull();
    expect(nearTag("nije datum", NOW)).toBeNull();
  });
  it("writes the academic year as the prototype's course card does (PAR2-A3)", () => {
    expect(yearLabel("2026/2027")).toBe("2026./27.");
    expect(yearLabel("2025/2026")).toBe("2025./26.");
    expect(yearLabel("2026./2027.")).toBe("2026./2027.");
    expect(yearLabel("")).toBe("");
  });
  it("has one work-type map for E-2 and E-3 (PAR2-A3)", () => {
    expect(workTypeLabel("short_paper")).toBe("Podnesak");
    expect(homeText.workTypes).toBe(coursesText.workTypes);
    expect(homeText.signedOut).toBe(coursesText.signedOut);
    expect(homeText.signIn).toBe(coursesText.signIn);
    expect(homeNearTag).toBe(nearTag);
  });
  it("marks practice only when the server says isPractice: true (P-D1)", () => {
    const base = { id: "a", title: "Izmišljeni probni esej", dueAt: "2026-12-01T10:00:00Z", noticeFirst: false };
    expect(practiceOf({ ...base, isPractice: true })).toBe(true);
    expect(practiceOf({ ...base, isPractice: false })).toBe(false);
    expect(practiceOf(base)).toBe(false);
    expect(practiceOf({ ...base, isPractice: "true" })).toBe(false);
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

describe("NF-1 P-5: the state filter", () => {
  it("accepts only the closed set, else everything", () => {
    expect(stateFilterOf("predano")).toBe("predano");
    expect(stateFilterOf("zapredati")).toBe("zapredati");
    expect(stateFilterOf("nesto")).toBe("sve");
    expect(stateFilterOf(null)).toBe("sve");
    expect(stateFilterOf("")).toBe("sve");
  });
  it("narrows the row kinds and never adds one", () => {
    const kinds = ["submitted", "notice", "work", "task"] as const;
    expect(kinds.filter((k) => matchesState(k, "sve"))).toEqual(["submitted", "notice", "work", "task"]);
    expect(kinds.filter((k) => matchesState(k, "zapredati"))).toEqual(["work", "task"]);
    expect(kinds.filter((k) => matchesState(k, "predano"))).toEqual(["submitted"]);
    expect(kinds.filter((k) => matchesState(k, "obavijest"))).toEqual(["notice"]);
  });
});

describe("NF-1 P-6: the submission time", () => {
  const fmt = (iso: string) => `[${iso}]`;
  it("shows a time only when the answer has a valid one", () => {
    expect(submittedOf({ assignmentId: "a", workState: "submitted" })).toBeNull();
    expect(submittedOf({ submittedAt: "sutra" })).toBeNull();
    expect(submittedOf({ submittedAt: 5 })).toBeNull();
    expect(submittedOf({ submittedAt: "2026-11-20T10:00:00.000Z" })).toEqual({ submittedAt: "2026-11-20T10:00:00.000Z", afterDeadline: false });
    expect(submittedOf({ submittedAt: "2026-11-20T10:00:00.000Z", afterDeadline: "true" })?.afterDeadline).toBe(false);
    expect(submittedOf({ submittedAt: "2026-11-20T10:00:00.000Z", afterDeadline: true })?.afterDeadline).toBe(true);
  });
  it("says Predano alone without a time, never a guessed one", () => {
    expect(submittedLine(null, fmt)).toBe("Predano");
    expect(submittedLine({ submittedAt: "2026-11-20T10:00:00.000Z", afterDeadline: false }, fmt)).toBe("Predano [2026-11-20T10:00:00.000Z]");
    expect(submittedLine({ submittedAt: "2026-11-20T10:00:00.000Z", afterDeadline: true }, fmt)).toBe("Predano [2026-11-20T10:00:00.000Z], nakon roka");
  });
  const work = { ok: true, status: 200, body: { assignments: [
    { assignmentId: "a", workState: "submitted" }, { assignmentId: "b", workState: "in_progress" },
    { assignmentId: "c", workState: "submitted" }, { assignmentId: "d", workState: "submitted" },
  ] } };
  const submissions = (body: unknown, asked: string[] = []) => (async (id: string) => {
    asked.push(id);
    if (id === "student.assignments.get") return { ok: true, status: 200, body: { courses: [] } };
    if (id === "student.assignment-work.get") return work;
    return body;
  }) as unknown as CoursesCall;
  it("reads the time from student.assignment-submissions.get, one call for the list", async () => {
    const asked: string[] = [];
    const call = submissions({ ok: true, status: 200, body: { assignments: [
      { assignmentId: "a", submittedAt: "2026-11-20T10:00:00.123456Z", afterDeadline: true },
      { assignmentId: "b", submittedAt: "2026-11-20T10:00:00.123456Z", afterDeadline: false },
      { assignmentId: "c", submittedAt: null, afterDeadline: null },
      { assignmentId: "d", submittedAt: "2026-11-21T09:00:00.000000Z", afterDeadline: false },
    ] } }, asked);
    const r = await readCourses(call, true);
    expect(r.kind === "ready" && [...(r.submitted ?? new Map()).keys()]).toEqual(["a", "d"]);
    expect(r.kind === "ready" && r.submitted?.get("a")?.afterDeadline).toBe(true);
    expect(r.kind === "ready" && r.submitted?.get("d")?.afterDeadline).toBe(false);
    expect(asked.filter((id) => id === "student.assignment-submissions.get")).toHaveLength(1);
  });
  it("ignores a time the work states do not prove, and the old work-state fields", async () => {
    const r = await readCourses(((id: string) => (id === "student.assignment-work.get"
      ? Promise.resolve({ ok: true, status: 200, body: { assignments: [{ assignmentId: "a", workState: "submitted", submittedAt: "2026-11-20T10:00:00.000Z", afterDeadline: true }] } })
      : id === "student.assignments.get" ? Promise.resolve({ ok: true, status: 200, body: { courses: [] } }) : Promise.resolve({ ok: true, status: 200, body: { assignments: [] } }))) as unknown as CoursesCall, true);
    expect(r.kind === "ready" && r.submitted?.size).toBe(0);
  });
  it("keeps the states and says Predano alone when the submissions read fails or is unreadable", async () => {
    for (const bad of [{ ok: false, status: 503 }, { ok: true, status: 200, body: {} }, { ok: true, status: 200, body: { assignments: [null, "x", { assignmentId: "a", submittedAt: "sutra", afterDeadline: true }] } }]) {
      const r = await readCourses(submissions(bad), true);
      expect(r.kind === "ready" && r.states?.get("a")).toBe("submitted");
      expect(r.kind === "ready" && r.submitted?.size).toBe(0);
    }
    const thrown = (async (id: string) => {
      if (id === "student.assignment-submissions.get") throw new Error("mreža");
      return id === "student.assignments.get" ? { ok: true, status: 200, body: { courses: [] } } : work;
    }) as unknown as CoursesCall;
    const r = await readCourses(thrown, true);
    expect(r.kind === "ready" && r.states?.get("a")).toBe("submitted");
  });
  it("does not ask for the times when the reader shows none (withTimes false)", async () => {
    const asked: string[] = [];
    await readCourses(submissions({ ok: true, status: 200, body: { assignments: [] } }, asked), true, false);
    expect(asked).not.toContain("student.assignment-submissions.get");
  });
  it("does not ask for the times when the states were not asked for", async () => {
    const asked: string[] = [];
    await readCourses(submissions({ ok: true, status: 200, body: { assignments: [] } }, asked), false);
    expect(asked).toEqual(["student.assignments.get"]);
  });
});

describe("NF-1 P-7: the history of an extended deadline", () => {
  const fmt = (iso: string) => iso.slice(0, 10);
  const rec = (over: object) => ({ id: "x", scope: "one", previousDueAt: "2026-11-01T10:00:00.000Z", dueAt: "2026-11-08T10:00:00.000Z", reasonId: "technical", createdAt: "2026-11-02T10:00:00.000Z", ...over });
  it("picks the record behind the deadline in force, the latest one", () => {
    const body = { extensions: [rec({ id: "1", dueAt: "2026-11-05T10:00:00.000Z" }), rec({ id: "2", reasonId: "agreement", createdAt: "2026-11-03T10:00:00.000Z" }), rec({ id: "3", reasonId: "justified", createdAt: "2026-11-02T12:00:00.000Z" })] };
    expect(extensionOf(body, "2026-11-08T10:00:00.000Z")).toEqual({ previousDueAt: "2026-11-01T10:00:00.000Z", scope: "one", reasonId: "agreement" });
  });
  it("is null for another shape, no matching record or a broken record", () => {
    expect(extensionOf(null, "2026-11-08T10:00:00.000Z")).toBeNull();
    expect(extensionOf({ extensions: "x" }, "2026-11-08T10:00:00.000Z")).toBeNull();
    expect(extensionOf({ extensions: [rec({ dueAt: "2030-01-01T00:00:00.000Z" })] }, "2026-11-08T10:00:00.000Z")).toBeNull();
    expect(extensionOf({ extensions: [rec({ scope: "nitko" })] }, "2026-11-08T10:00:00.000Z")).toBeNull();
    expect(extensionOf({ extensions: [rec({ previousDueAt: "nije datum" })] }, "2026-11-08T10:00:00.000Z")).toBeNull();
  });
  it("tells the reason of a closed set, or leaves it out when unknown", () => {
    const note = extensionOf({ extensions: [rec({ scope: "all", reasonId: "justified" })] }, "2026-11-08T10:00:00.000Z")!;
    expect(extensionText(note, fmt)).toBe("Prethodni rok: 2026-11-01. Razlog: opravdani razlog. Vrijedi za sve studente kolegija.");
    const unknown = extensionOf({ extensions: [rec({ reasonId: "nesto" })] }, "2026-11-08T10:00:00.000Z")!;
    expect(extensionText(unknown, fmt)).toBe("Prethodni rok: 2026-11-01. Vrijedi za samo Vas.");
  });
  it("asks only for assignments with an extended deadline, and a failure leaves that one out", async () => {
    const asked: string[] = [];
    const course = { id: "c", name: "K", assignments: [
      { id: "a", title: "A", dueAt: "2026-11-01T10:00:00.000Z", noticeFirst: false, extendedDueAt: "2026-11-08T10:00:00.000Z" },
      { id: "b", title: "B", dueAt: "2026-11-01T10:00:00.000Z", noticeFirst: false },
      { id: "d", title: "D", dueAt: "2026-11-01T10:00:00.000Z", noticeFirst: false, extendedDueAt: "2026-11-08T10:00:00.000Z" },
    ] } as Course;
    const notes = await readExtensions(async (id) => {
      asked.push(id);
      if (id === "d") throw new Error("mreža");
      return { ok: true, body: { extensions: [rec({})] } };
    }, [course]);
    expect(asked.sort()).toEqual(["a", "d"]);
    expect([...notes.keys()]).toEqual(["a"]);
  });
});

describe("P-3 deadline tag on E-3 and E-4 (one function with E-2)", () => {
  const now = Date.parse("2026-11-22T10:00:00Z");
  const base = { submitted: false, dueAt: "2026-11-18T22:59:00.000Z", extended: false, originalDueAt: "2026-11-18T22:59:00.000Z" };
  it("says the deadline has passed, with its date in Zagreb", () => {
    expect(deadlineTagOf(base, now)).toEqual({ kind: "late", text: "Rok je prošao 18. 11. 2026." });
  });
  it("tells a running extension apart: the original deadline has passed", () => {
    expect(deadlineTagOf({ ...base, dueAt: "2026-11-30T22:59:00.000Z", extended: true }, now))
      .toEqual({ kind: "extension", text: "Izvorni rok je prošao 18. 11. 2026." });
    expect(deadlineTagOf({ ...base, dueAt: "2026-11-19T22:59:00.000Z", extended: true }, now)?.kind).toBe("late");
  });
  it("is none for a submitted work, before the deadline and for a deadline that does not parse", () => {
    expect(deadlineTagOf({ ...base, submitted: true }, now)).toBeNull();
    expect(deadlineTagOf({ ...base, dueAt: "2026-11-30T10:00:00Z", originalDueAt: "2026-11-30T10:00:00Z" }, now)).toBeNull();
    expect(deadlineTagOf({ ...base, dueAt: "nije datum" }, now)).toBeNull();
  });
});
