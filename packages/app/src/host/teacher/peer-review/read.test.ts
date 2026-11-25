import { describe, expect, it, vi } from "vitest";

import { allocate, putRound, readOverview, readRound, withdrawReview } from "./read";

const answer = (r: unknown) => ({ call: vi.fn(async () => r) as never });
const refused = (status: number, code: string) => answer({ ok: false, status, code });
const BODY = { opensAt: "2026-12-01T08:00:00.000Z", dueAt: "2026-12-10T17:30:00.000Z", reviewsPerStudent: 2 as const, rubrics: [{ key: "k-1", label: "Argument" }] };

describe("the reads keep a refusal apart from an empty answer", () => {
  it("an answer is ok, whatever it holds", async () => {
    const body = { allocations: [] };
    expect(await readOverview(answer({ ok: true, status: 200, body }).call, "a")).toEqual({ kind: "ok", value: body });
  });
  it.each([[401, "unauthorized", "signedOut"], [401, "session_expired", "signedOut"], [404, "not_found", "notFound"], [503, "unavailable", "unavailable"], [0, "client_rejected", "unavailable"]])("%s %s is %s", async (status, code, kind) => {
    for (const read of [readRound, readOverview]) expect(await read(refused(status, code).call, "x")).toEqual({ kind });
  });
  it("a broken connection is unavailable, not an empty list", async () => {
    const call = vi.fn(async () => { throw new Error("down"); }) as never;
    expect(await readOverview(call, "a")).toEqual({ kind: "unavailable" });
    expect(await readRound(call, "a")).toEqual({ kind: "unavailable" });
  });
  it("asks the operations of the contract with the id in params", async () => {
    const { call } = answer({ ok: true, status: 200, body: { round: null, state: "none", submittedWorks: 0, minSubmissions: 3 } });
    await readRound(call, "a1");
    expect(call).toHaveBeenCalledWith("peer-review.round.get", { params: { assignmentId: "a1" }, query: undefined, body: undefined });
  });
});

describe("the writes", () => {
  it("putRound sends the body and returns the round as set", async () => {
    const { call } = answer({ ok: true, status: 200, body: { round: { roundId: "r" } } });
    expect(await putRound(call, "a1", BODY)).toEqual({ kind: "done", value: { roundId: "r" } });
    expect(call).toHaveBeenCalledWith("peer-review.round.put", { params: { assignmentId: "a1" }, query: undefined, body: BODY });
  });
  it.each([
    [401, "unauthorized", "signedOut"], [404, "not_found", "notFound"], [409, "already_allocated", "already"], [409, "too_few_submissions", "tooFew"],
    [409, "conflict", "conflict"], [422, "invalid_input", "invalid"], [400, "invalid_json", "invalid"], [0, "client_rejected", "invalid"],
    [503, "unavailable", "unknown"], [500, "boom", "unknown"],
  ])("a refusal %s %s is %s on every write", async (status, code, kind) => {
    expect(await putRound(refused(status, code).call, "a", BODY)).toEqual({ kind });
    expect(await allocate(refused(status, code).call, "a")).toEqual({ kind });
    expect(await withdrawReview(refused(status, code).call, "a", "r", "razlog")).toEqual({ kind });
  });
  it("a lost answer is unknown, never done", async () => {
    const call = vi.fn(async () => { throw new Error("down"); }) as never;
    expect(await putRound(call, "a", BODY)).toEqual({ kind: "unknown" });
    expect(await allocate(call, "a")).toEqual({ kind: "unknown" });
    expect(await withdrawReview(call, "a", "r", "razlog")).toEqual({ kind: "unknown" });
  });
  it("allocate returns the count and withdraw sends the reason for that review", async () => {
    expect(await allocate(answer({ ok: true, status: 201, body: { allocated: 6 } }).call, "a")).toEqual({ kind: "done", value: 6 });
    const { call } = answer({ ok: true, status: 201, body: { reviewId: "r1" } });
    expect(await withdrawReview(call, "a1", "r1", "razlog")).toEqual({ kind: "done", value: undefined });
    expect(call).toHaveBeenCalledWith("peer-review.review-withdrawal.post", { params: { assignmentId: "a1", reviewId: "r1" }, query: undefined, body: { reason: "razlog" } });
  });
});
