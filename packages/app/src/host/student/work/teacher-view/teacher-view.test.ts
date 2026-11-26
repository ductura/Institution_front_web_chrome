import { describe, expect, it } from "vitest";

import { editorWorkRead } from "../../../../../../../src/components/editor/EditorPage.read.ts";
import { resolve } from "../../../../routes";
import { rowsOf } from "./model";

// Invented data only.
const ID = "11111111-1111-4111-8111-111111111111";
const assignments = { ok: true, status: 200, body: { courses: [{ name: "Kolegij A", assignments: [{ id: ID, title: "Zadatak A", dueAt: "2026-12-01T10:00:00Z", noticeFirst: false }] }] } } as const;
const work = { ok: true, status: 200, body: { assignments: [{ assignmentId: ID, workState: "in_progress" }] } } as const;

describe("F4-EDI-R14 Kako vidi nastavnik", () => {
  it("has rows only from the student's own reads", () => {
    expect(rowsOf(editorWorkRead(ID, assignments, work))).toEqual({ course: "Kolegij A", title: "Zadatak A", dueAt: "2026-12-01T10:00:00Z", workState: "in_progress" });
  });
  it("has no rows for someone else's assignment, signed out or a failed read", () => {
    expect(rowsOf(editorWorkRead("22222222-2222-4222-8222-222222222222", assignments, work))).toBeNull();
    expect(rowsOf(editorWorkRead(ID, { ok: false, status: 401 }, work))).toBeNull();
    expect(rowsOf(editorWorkRead(ID, assignments, { ok: false, status: 0 }))).toBeNull();
  });
  it("the route exists for the student only", () => {
    expect(resolve(`/rad/${ID}/nastavnik`, "student")).toMatchObject({ kind: "page", page: { label: "Kako vidi nastavnik" } });
    expect(resolve(`/rad/${ID}/nastavnik`, "teacher")).not.toMatchObject({ kind: "page" });
  });
});
