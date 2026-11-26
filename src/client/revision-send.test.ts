import { describe, expect, it, vi } from "vitest";

import { sendRevisionStatus } from "./revision-send";

const api = (value: unknown) => vi.fn(async () => value) as never;

describe("sendRevisionStatus (ED-43)", () => {
  it("posts the document and the message, without params", async () => {
    const call = vi.fn(async () => ({ ok: true, status: 200, body: { round: 2 } }));
    expect(await sendRevisionStatus("d1", "Dopunio sam uvod.", call as never)).toBe(200);
    expect(call).toHaveBeenCalledWith("collaboration.revision-send.post", {
      params: undefined, query: undefined, body: { documentId: "d1", message: "Dopunio sam uvod." },
    });
  });
  it("sends an empty message as null", async () => {
    const call = vi.fn(async () => ({ ok: true, status: 200, body: { round: 1 } }));
    await sendRevisionStatus("d1", "", call as never);
    expect((call.mock.calls[0] as unknown[])[1]).toMatchObject({ body: { documentId: "d1", message: null } });
  });
  it("is sent only when the answer carries a round", async () => {
    expect(await sendRevisionStatus("d", "", api({ ok: true, status: 200, body: { round: 0 } }))).toBeNull();
    expect(await sendRevisionStatus("d", "", api({ ok: true, status: 200, body: {} }))).toBeNull();
  });
  it("passes 401, 403 and 409 on and makes everything else unknown", async () => {
    const fail = (status: number) => sendRevisionStatus("d", "x", api({ ok: false, status }));
    expect(await fail(401)).toBe(401);
    expect(await fail(403)).toBe(403);
    expect(await fail(409)).toBe(409);
    expect(await fail(404)).toBeNull();
    expect(await fail(503)).toBeNull();
    expect(await sendRevisionStatus("d", "x", vi.fn(async () => { throw new Error("mreža"); }) as never)).toBeNull();
  });
});
