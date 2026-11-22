import { describe, expect, it } from "vitest";

import { indexRead } from "./model";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const ok = <T,>(body: T) => ({ ok: true, status: 200, body }) as const;
const assignments = (...rows: [string, boolean][]) =>
  ok({ courses: [{ name: "Kolegij A", assignments: rows.map(([id, noticeFirst]) => ({ id, title: `Zadatak ${id.slice(0, 2)}`, dueAt: "2026-12-01T10:00:00Z", noticeFirst })) }] });
const work = (...rows: [string, string][]) => ok({ assignments: rows.map(([assignmentId, workState]) => ({ assignmentId, workState })) });

describe("indexRead (/rad)", () => {
  it("a 401 from either read is signed out", () => {
    expect(indexRead({ ok: false, status: 401 }, work(), null)).toEqual({ kind: "signedOut" });
    expect(indexRead(assignments(), { ok: false, status: 401 }, null)).toEqual({ kind: "signedOut" });
  });
  it("a failed read is unavailable, never an empty workspace", () => {
    expect(indexRead({ ok: false, status: 500 }, work(), null)).toEqual({ kind: "unavailable" });
    expect(indexRead(assignments(), { ok: false, status: 0 }, null)).toEqual({ kind: "unavailable" });
  });
  it("?zadatak with a valid id goes to that work; a bad one is ignored", () => {
    expect(indexRead(assignments(), work(), A.toUpperCase())).toEqual({ kind: "go", assignmentId: A });
    expect(indexRead(assignments(), work(), "nije-uuid")).toEqual({ kind: "empty" });
  });
  it("no work in progress is empty (not_started and submitted do not count)", () => {
    expect(indexRead(assignments([A, false], [B, false]), work([A, "not_started"], [B, "submitted"]), null)).toEqual({ kind: "empty" });
  });
  it("one work in progress opens it; a notice not yet acknowledged does not count", () => {
    expect(indexRead(assignments([A, false], [B, true]), work([A, "in_progress"], [B, "in_progress"]), null)).toEqual({ kind: "go", assignmentId: A });
  });
  it("several works in progress are listed", () => {
    const read = indexRead(assignments([A, false], [B, false]), work([A, "in_progress"], [B, "in_progress"]), null);
    expect(read.kind).toBe("list");
    expect(read.kind === "list" && read.items.map((i) => i.id)).toEqual([A, B]);
  });
});
