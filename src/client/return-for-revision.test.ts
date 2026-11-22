import { describe, expect, it, vi } from "vitest";

import { returnStatus, returnWorkForRevision } from "./return-for-revision";

const ok = (over: object = {}) => ({
  ok: true, status: 200,
  body: { id: "aaaaaaaa-0000-4000-8000-000000000001", state: "returned_for_revision", round: 1, comment: "Dopuni uvod.", revisionDueAt: null, returnedAt: "2026-11-22T10:00:00.000Z", ...over },
});
const api = (value: unknown) => vi.fn(async () => value) as never;

describe("returnWorkForRevision", () => {
  it("posts the comment and the deadline under the document", async () => {
    const call = vi.fn(async () => ok());
    await returnWorkForRevision("d1", "Dopuni uvod.", "2026-12-01T22:59:00.000Z", call as never);
    expect(call).toHaveBeenCalledWith("work.return-for-revision.post", {
      params: { documentId: "d1" }, query: undefined, body: { comment: "Dopuni uvod.", revisionDueAt: "2026-12-01T22:59:00.000Z" },
    });
  });
  it("sends no deadline field when there is none", async () => {
    const call = vi.fn(async () => ok());
    await returnWorkForRevision("d1", "Dopuni uvod.", null, call as never);
    expect((call.mock.calls[0] as unknown[])[1]).toMatchObject({ body: { comment: "Dopuni uvod." } });
    expect(JSON.stringify((call.mock.calls[0] as unknown[])[1])).not.toContain("revisionDueAt");
  });
  it("is returned only when the answer names the state and the same comment", async () => {
    expect((await returnWorkForRevision("d", "Dopuni uvod.", null, api(ok()))).kind).toBe("returned");
    expect((await returnWorkForRevision("d", "Dopuni uvod.", null, api(ok({ comment: "Drugo." })))).kind).toBe("nepoznato");
  });
  it("maps 401, 403, 409 and everything else", async () => {
    const fail = (status: number) => returnWorkForRevision("d", "x", null, api({ ok: false, status }));
    expect([(await fail(401)).kind, (await fail(403)).kind, (await fail(409)).kind, (await fail(404)).kind, (await fail(503)).kind])
      .toEqual(["session-expired", "forbidden", "conflict", "nepoznato", "nepoznato"]);
    expect((await returnWorkForRevision("d", "x", null, vi.fn(async () => { throw new Error("x"); }) as never)).kind).toBe("nepoznato");
  });
});

describe("returnStatus", () => {
  it("gives 200 only for a confirmed return and null when unknown", async () => {
    expect(await returnStatus("d", "Dopuni uvod.", null, api(ok()))).toBe(200);
    expect(await returnStatus("d", "Dopuni uvod.", null, api({ ok: false, status: 409 }))).toBe(409);
    expect(await returnStatus("d", "Dopuni uvod.", null, api({ ok: false, status: 500 }))).toBeNull();
  });
});
