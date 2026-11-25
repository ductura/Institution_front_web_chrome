import { describe, expect, it, vi } from "vitest";

import { readReceived, readTasks, readWork, sendReview } from "./read";

const answer = (r: unknown) => ({ call: vi.fn(async () => r) as never });
const refused = (status: number, code: string) => answer({ ok: false, status, code });

describe("the reads keep a refusal apart from an empty answer", () => {
  it("an answer is ok, whatever it holds", async () => {
    expect(await readTasks(answer({ ok: true, status: 200, body: { state: "none", tasks: [] } }).call, "a")).toEqual({ kind: "ok", view: { state: "none", tasks: [] } });
  });
  it.each([[401, "unauthorized", "signedOut"], [401, "session_expired", "signedOut"], [404, "not_found", "notFound"], [503, "unavailable", "unavailable"], [0, "client_rejected", "unavailable"]])("%s %s is %s", async (status, code, kind) => {
    for (const read of [readTasks, readReceived, readWork]) expect(await read(refused(status, code).call, "x")).toEqual({ kind });
  });
  it("a broken connection is unavailable, not an empty list", async () => {
    const call = vi.fn(async () => { throw new Error("down"); }) as never;
    expect(await readTasks(call, "a")).toEqual({ kind: "unavailable" });
    expect(await readReceived(call, "a")).toEqual({ kind: "unavailable" });
  });
  it("asks the operation of the contract with the id in params", async () => {
    const { call } = answer({ ok: true, status: 200, body: { reviews: [] } });
    await readReceived(call, "a1");
    expect(call).toHaveBeenCalledWith("student.peer-reviews-received.get", { params: { assignmentId: "a1" }, query: undefined, body: undefined });
  });
});

describe("sendReview", () => {
  const body = { byRubric: [{ key: "argument", text: "ok" }] };
  it.each([
    [{ ok: true, status: 201, body: { reviewId: "r" } }, "done"],
    [{ ok: false, status: 401, code: "unauthorized" }, "signedOut"],
    [{ ok: false, status: 404, code: "not_found" }, "notFound"],
    [{ ok: false, status: 409, code: "closed" }, "closed"],
    [{ ok: false, status: 409, code: "already_reviewed" }, "alreadyReviewed"],
    [{ ok: false, status: 422, code: "invalid_input" }, "invalid"],
    [{ ok: false, status: 0, code: "client_rejected" }, "invalid"],
    [{ ok: false, status: 503, code: "unavailable" }, "unknown"],
  ])("%j is %s", async (result, kind) => {
    expect(await sendReview(answer(result).call, "t", body)).toEqual({ kind });
  });
  it("a broken connection may have recorded the review: unknown", async () => {
    expect(await sendReview(vi.fn(async () => { throw new Error("cut"); }) as never, "t", body)).toEqual({ kind: "unknown" });
  });
});
