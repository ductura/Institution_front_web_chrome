import { describe, expect, it, vi } from "vitest";

import { readMyNumbers } from "./read";

type Answer = { ok: true; status: number; body: unknown } | { ok: false; status: number; code: string };
const ok = (body: unknown): Answer => ({ ok: true, status: 200, body });
const fail = (status: number, code: string): Answer => ({ ok: false, status, code });
const NOW = new Date("2026-12-07T12:00:00.000Z");
const WORK = (id: string, state = "in_progress") => ({ workId: id, assignmentTitle: `Zadatak ${id}`, courseName: "Izmišljeni kolegij", dueAt: "2026-12-10T10:00:00.000Z", state });
const VERSIONS = { versions: [{ kind: "checkpoint", revision: 2, savedMinute: "2026-11-02T09:00:00.000Z" }, { kind: "checkpoint", revision: 1, savedMinute: "2026-11-01T09:00:00.000Z" }], nextBeforeRevision: null };

/** The test double stands where createApi() stands; it answers by operation. */
const api = (by: Record<string, (input: { params?: { documentId?: string } }) => Answer>) =>
  vi.fn(async (op: string, input: { params?: { documentId?: string } }) => (by[op] ?? (() => fail(500, "x")))(input)) as never;

describe("readMyNumbers", () => {
  it("figures come from the versions of each own work, asked by its id", async () => {
    const call = api({
      "student-work.works.get": () => ok({ works: [WORK("a")] }),
      "work.versions.get": () => ok(VERSIONS),
      "work.milestone-states.get": () => ok({ milestones: [{ state: "approved" }, { state: "submitted" }] }),
    });
    const r = await readMyNumbers(call, NOW);
    expect(r).toMatchObject({ kind: "ready", items: [{ versions: { count: 2, more: false }, days: { count: 2 }, daysLeft: 3, milestones: { done: 1, total: 2 } }] });
    expect((call as unknown as ReturnType<typeof vi.fn>).mock.calls.some(([op, i]) => op === "work.versions.get" && i.params.documentId === "a")).toBe(true);
  });
  it("no works is empty, not zeros", async () => {
    expect(await readMyNumbers(api({ "student-work.works.get": () => ok({ works: [] }) }), NOW)).toEqual({ kind: "empty" });
  });
  it("keeps signed out and unavailable apart; neither is an empty page", async () => {
    expect(await readMyNumbers(api({ "student-work.works.get": () => fail(401, "unauthorized") }), NOW)).toEqual({ kind: "signedOut" });
    expect(await readMyNumbers(api({ "student-work.works.get": () => fail(503, "unavailable") }), NOW)).toEqual({ kind: "unavailable" });
    const boom = vi.fn(async () => { throw new TypeError("network"); }) as never;
    expect(await readMyNumbers(boom, NOW)).toEqual({ kind: "unavailable" });
  });
  it("another student's or unknown work (404) is left out; a failed read of one work shows 'not available', not zero", async () => {
    const r = await readMyNumbers(api({
      "student-work.works.get": () => ok({ works: [WORK("a"), WORK("b"), WORK("c")] }),
      "work.versions.get": ({ params }) => (params?.documentId === "a" ? fail(404, "not_found") : params?.documentId === "b" ? fail(503, "unavailable") : ok(VERSIONS)),
    }), NOW);
    expect(r.kind).toBe("ready");
    if (r.kind !== "ready") return;
    expect(r.items.map((i) => i.work.workId)).toEqual(["b", "c"]);
    expect(r.items[0]!.versions).toBeNull();
    expect(r.items[1]!.versions?.count).toBe(2);
  });
  it("signed out on one work is signed out for the page", async () => {
    const r = await readMyNumbers(api({ "student-work.works.get": () => ok({ works: [WORK("a")] }), "work.versions.get": () => fail(401, "unauthorized") }), NOW);
    expect(r).toEqual({ kind: "signedOut" });
  });
  it("a submitted work shows no days to deadline", async () => {
    const r = await readMyNumbers(api({ "student-work.works.get": () => ok({ works: [WORK("a", "submitted")] }), "work.versions.get": () => ok(VERSIONS) }), NOW);
    expect(r).toMatchObject({ kind: "ready", items: [{ daysLeft: null }] });
  });
});
