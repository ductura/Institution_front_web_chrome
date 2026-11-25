import { describe, expect, it, vi } from "vitest";

import { openPlacement, signEntries } from "./read";

type Answer = { ok: true; status: number; body: unknown } | { ok: false; status: number; code: string };
const api = (answer: Answer) => vi.fn(async () => answer) as never;
const fail = (status: number, code: string): Answer => ({ ok: false, status, code });
const OPEN = { mentorshipId: "m1", organisationName: "Izmišljena d.o.o.", startsOn: "2026-03-02", endsOn: "2026-06-30" };

describe("openPlacement", () => {
  it("sends the body to practice.placements.post and returns the id", async () => {
    const call = vi.fn(async () => ({ ok: true as const, status: 201, body: { placementId: "p1" } }));
    expect(await openPlacement(call as never, OPEN)).toEqual({ kind: "opened", placementId: "p1" });
    expect(call).toHaveBeenCalledWith("practice.placements.post", { params: undefined, query: undefined, body: OPEN });
  });
  it("keeps every refusal apart and never calls a refusal opened", async () => {
    expect(await openPlacement(api(fail(401, "unauthorized")), OPEN)).toEqual({ kind: "signedOut" });
    expect(await openPlacement(api(fail(404, "not_found")), OPEN)).toEqual({ kind: "notFound" });
    expect(await openPlacement(api(fail(422, "invalid_input")), OPEN)).toEqual({ kind: "invalid" });
    expect(await openPlacement(api(fail(503, "unavailable")), OPEN)).toEqual({ kind: "unknown" });
    expect(await openPlacement(api(fail(403, "origin_mismatch")), OPEN)).toEqual({ kind: "unknown" });
  });
  it("a rejected transport is unknown, never an exception", async () => {
    expect(await openPlacement(vi.fn(async () => { throw new TypeError("network"); }) as never, OPEN)).toEqual({ kind: "unknown" });
  });
});

describe("signEntries", () => {
  it("asks for the practice by its id with the body as given", async () => {
    const call = vi.fn(async () => ({ ok: true as const, status: 201, body: { signoffId: "s1", entryCount: 3, entriesSha256: "0".repeat(64) } }));
    expect(await signEntries(call as never, "p1", { throughDate: "2026-04-05" })).toEqual({ kind: "signed", entryCount: 3, signoffId: "s1" });
    expect(call).toHaveBeenCalledWith("practice.signoffs.post", { params: { placementId: "p1" }, query: undefined, body: { throughDate: "2026-04-05" } });
  });
  it("reads another mentor's or an unknown practice as not found, and 409 as nothing to sign", async () => {
    expect(await signEntries(api(fail(404, "not_found")), "p9", { throughDate: "2026-04-05" })).toEqual({ kind: "notFound" });
    expect(await signEntries(api(fail(409, "nothing_to_sign")), "p1", { throughDate: "2026-04-05" })).toEqual({ kind: "nothingToSign" });
    expect(await signEntries(api(fail(401, "session_expired")), "p1", { throughDate: "2026-04-05" })).toEqual({ kind: "signedOut" });
    expect(await signEntries(api(fail(422, "invalid_input")), "p1", { throughDate: "2026-04-05" })).toEqual({ kind: "invalid" });
  });
  it("a lost answer is unknown: the signature may have been recorded", async () => {
    expect(await signEntries(api(fail(503, "unavailable")), "p1", { throughDate: "2026-04-05" })).toEqual({ kind: "unknown" });
    expect(await signEntries(vi.fn(async () => { throw new Error("x"); }) as never, "p1", { throughDate: "2026-04-05" })).toEqual({ kind: "unknown" });
  });
});
