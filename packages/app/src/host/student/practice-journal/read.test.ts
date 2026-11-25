import { describe, expect, it, vi } from "vitest";

import { addEntry, readEntries, readPlacements } from "./read";

type Answer = { ok: true; status: number; body: unknown } | { ok: false; status: number; code: string };
// The test double stands where createApi() stands; it answers by operation.
const api = (answer: Answer) => vi.fn(async () => answer) as never;
const fail = (status: number, code: string): Answer => ({ ok: false, status, code });
const ENTRY = { date: "2026-04-10", hours: 2, text: "Izmišljeni zapis" } as const;

describe("readPlacements", () => {
  it("returns the practices of the answer", async () => {
    const r = await readPlacements(api({ ok: true, status: 200, body: { placements: [] } }));
    expect(r).toEqual({ kind: "ok", placements: [] });
  });
  it("keeps signed out and unavailable apart, and neither is an empty list", async () => {
    expect(await readPlacements(api(fail(401, "unauthorized")))).toEqual({ kind: "signedOut" });
    expect(await readPlacements(api(fail(503, "unavailable")))).toEqual({ kind: "unavailable" });
    expect(await readPlacements(api(fail(0, "unexpected")))).toEqual({ kind: "unavailable" });
  });
});

describe("readEntries", () => {
  it("asks for the practice by its id", async () => {
    const call = vi.fn(async () => ({ ok: true as const, status: 200, body: { entries: [], signoffs: [] } }));
    await readEntries(call as never, "p1");
    expect(call).toHaveBeenCalledWith("practice.entries.get", { params: { placementId: "p1" }, query: undefined, body: undefined });
  });
  it("reads another student's or an unknown practice as not found", async () => {
    expect(await readEntries(api(fail(404, "not_found")), "p9")).toEqual({ kind: "notFound" });
  });
  it("is unavailable on a server fault and signed out on 401", async () => {
    expect(await readEntries(api(fail(503, "unavailable")), "p1")).toEqual({ kind: "unavailable" });
    expect(await readEntries(api(fail(401, "unauthorized")), "p1")).toEqual({ kind: "signedOut" });
  });
});

describe("addEntry", () => {
  it("is saved only on the server's 201", async () => {
    expect(await addEntry(api({ ok: true, status: 201, body: { entryId: "e1" } }), "p1", ENTRY)).toEqual({ kind: "saved", entryId: "e1" });
  });
  it.each([
    [fail(404, "not_found"), "notFound"],
    [fail(409, "placement_closed"), "closed"],
    [fail(409, "conflict"), "conflict"],
    [fail(400, "invalid_input"), "invalid"],
    [fail(0, "client_rejected"), "invalid"],
    [fail(401, "unauthorized"), "signedOut"],
    [fail(503, "unavailable"), "unknown"],
    [fail(0, "unexpected"), "unknown"],
  ] as const)("maps %j to %s", async (answer, kind) => {
    expect((await addEntry(api(answer), "p1", ENTRY)).kind).toBe(kind);
  });
  it("sends a correction with the id it corrects", async () => {
    const call = vi.fn(async () => ({ ok: true as const, status: 201, body: { entryId: "e2" } }));
    await addEntry(call as never, "p1", { ...ENTRY, correctsEntryId: "e1" });
    expect(call).toHaveBeenCalledWith("practice.entries.post", { params: { placementId: "p1" }, query: undefined, body: { ...ENTRY, correctsEntryId: "e1" } });
  });
});
