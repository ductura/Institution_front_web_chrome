import { describe, expect, it } from "vitest";

import { frameFailureOf, assignmentIdOf, editorWorkRead } from "./EditorPage.read";

// WEB-14: the editor page's read of one assignment from student.assignments.get
// and student.assignment-work.get. Invented data only.
const ID = "0b6f3c2e-4a1d-4c8e-9f20-1a2b3c4d5e6f";
const OTHER = "9e8d7c6b-5a49-4382-8170-6f5e4d3c2b1a";
const assignment = { id: ID, title: "Seminarski rad: kućno kompostiranje", dueAt: "2027-01-15T22:59:00.000Z", noticeFirst: false };
const courses = (a = assignment) => ({ ok: true as const, status: 200, body: { courses: [{ name: "Izmišljeni seminar iz ekologije grada", assignments: [a] }] } });
const works = (workState: string, assignmentId = ID) => ({ ok: true as const, status: 200, body: { assignments: [{ assignmentId, workState }] } });

describe("assignmentIdOf", () => {
  it("takes a UUID in lowercase and refuses anything else", () => {
    expect(assignmentIdOf(ID.toUpperCase())).toBe(ID);
    for (const raw of ["", "rad", `${ID}x`, "../x", ID.replace(/-/g, "")]) expect(assignmentIdOf(raw)).toBeNull();
  });
});

describe("editorWorkRead", () => {
  it("is ready with the course, title and work state", () => {
    expect(editorWorkRead(ID, courses(), works("in_progress"))).toEqual({
      kind: "ready", course: "Izmišljeni seminar iz ekologije grada", title: assignment.title, dueAt: assignment.dueAt, workState: "in_progress",
    });
    expect(editorWorkRead(ID, courses({ ...assignment, id: ID.toUpperCase() }), works("submitted"))).toMatchObject({ kind: "ready", workState: "submitted" });
  });

  it("is signed out on a 401 from either read", () => {
    expect(editorWorkRead(ID, { ok: false, status: 401 }, works("in_progress"))).toEqual({ kind: "signedOut" });
    expect(editorWorkRead(ID, courses(), { ok: false, status: 401 })).toEqual({ kind: "signedOut" });
  });

  it("keeps a 403 and a 404 an unavailable read unless the page asks for the refusals", () => {
    expect(editorWorkRead(ID, { ok: false, status: 403 }, works("in_progress"))).toEqual({ kind: "unavailable" });
    expect(editorWorkRead(ID, courses(), { ok: false, status: 404 })).toEqual({ kind: "unavailable" });
  });

  it("S-08 X1, X2: with the refusals a 403 is denied and a 404 not found, from either read; 401 stays signed out", () => {
    const refusals = { refusals: true } as const;
    expect(editorWorkRead(ID, { ok: false, status: 403 }, works("in_progress"), refusals)).toEqual({ kind: "denied" });
    expect(editorWorkRead(ID, courses(), { ok: false, status: 403 }, refusals)).toEqual({ kind: "denied" });
    expect(editorWorkRead(ID, { ok: false, status: 404 }, works("in_progress"), refusals)).toEqual({ kind: "notFound" });
    expect(editorWorkRead(ID, courses(), { ok: false, status: 404 }, refusals)).toEqual({ kind: "notFound" });
    expect(editorWorkRead(ID, { ok: false, status: 401 }, { ok: false, status: 403 }, refusals)).toEqual({ kind: "signedOut" });
    // Every other failure is still unavailable, and no answer at all is the network.
    expect(editorWorkRead(ID, { ok: false, status: 500 }, works("in_progress"), refusals)).toEqual({ kind: "unavailable" });
    expect(editorWorkRead(ID, { ok: false, status: 0 }, works("in_progress"), refusals)).toEqual({ kind: "unavailable" });
  });

  it("carries an extended deadline and the work type only when the read has them", () => {
    const read = editorWorkRead(ID, courses({ ...assignment, extendedDueAt: "2027-01-20T22:59:00.000Z", workType: "essay" } as typeof assignment), works("in_progress"));
    expect(read).toMatchObject({ kind: "ready", dueAt: assignment.dueAt, extendedDueAt: "2027-01-20T22:59:00.000Z", workType: "essay" });
  });

  it("opens the notice first when it is not acknowledged", () => {
    expect(editorWorkRead(ID, courses({ ...assignment, noticeFirst: true }), works("in_progress"))).toEqual({ kind: "noticeFirst" });
  });

  it("is not found for an assignment the caller does not have", () => {
    expect(editorWorkRead(OTHER, courses(), works("in_progress"))).toEqual({ kind: "notFound" });
    expect(editorWorkRead(ID, { ok: true, status: 200, body: { courses: [] } }, works("in_progress", OTHER))).toEqual({ kind: "notFound" });
  });

  it("never guesses: a failed read, a missing row or an unknown state is unavailable", () => {
    expect(editorWorkRead(ID, { ok: false, status: 503 }, works("in_progress"))).toEqual({ kind: "unavailable" });
    expect(editorWorkRead(ID, courses(), { ok: false, status: 0 })).toEqual({ kind: "unavailable" });
    expect(editorWorkRead(ID, courses(), works("in_progress", OTHER))).toEqual({ kind: "unavailable" });
    expect(editorWorkRead(ID, courses(), works("draft"))).toEqual({ kind: "unavailable" });
  });
});

describe("frameFailureOf (ED-01b)", () => {
  it("no answer from either read is the network; any other failure is the server", () => {
    expect(frameFailureOf({ status: 0 }, { status: 200 })).toBe("offline");
    expect(frameFailureOf({ status: 200 }, { status: 0 })).toBe("offline");
    expect(frameFailureOf({ status: 503 }, { status: 200 })).toBe("server");
    expect(frameFailureOf({ status: 200 }, { status: 403 })).toBe("server");
    expect(frameFailureOf({ status: 200 }, { status: 200 })).toBe("server");
  });
});