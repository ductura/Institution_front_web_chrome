import { describe, expect, it, vi } from "vitest";

import { createApi } from "@/client/api";

import { markNoticeRead } from "./notice-read-mark";

const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AT = "2026-11-19T12:00:00.000Z";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function wire(reply: () => Response | Promise<Response>) {
  const send = vi.fn(async (_url: URL | string, _init?: RequestInit) => reply());
  return { send, api: createApi({ baseUrl: "http://web.test", fetchImpl: send as unknown as typeof fetch }) };
}

describe("WEB-12 PO-7 notice read over student.notice-read.post", () => {
  it("posts only the shown version to the contract route and returns the server time", async () => {
    const { send, api } = wire(() => json({ readAt: AT }));
    expect(await markNoticeRead(ID, 2, api)).toEqual({ kind: "read", at: AT });
    const [url, init] = send.mock.calls[0]!;
    expect(new URL(String(url)).pathname).toBe(`/api/v1/student/assignments/${ID}/notice-read`);
    expect(init).toMatchObject({ method: "POST" });
    expect(JSON.parse(init!.body as string)).toEqual({ versionNo: 2 });
  });

  it("sends nothing for a malformed id or version", async () => {
    const { send, api } = wire(() => json({ readAt: AT }));
    for (const [id, version] of [["x", 1], [ID, 0], [ID, 1.5], [ID, 2 ** 31]] as const) {
      expect((await markNoticeRead(id, version, api)).kind).toBe("invalid");
    }
    // 2^31 passes the local check but not the contract: the client refuses it before the network.
    expect(send).not.toHaveBeenCalled();
  });

  it.each([
    [409, "stale", "conflict"],
    [401, "signedOut", "unauthorized"],
    [404, "notFound", "not_found"],
    [403, "invalid", "origin_mismatch"],
    [422, "invalid", "invalid_input"],
    [503, "unavailable", "unavailable"],
  ] as const)("keeps HTTP %i as %s", async (status, kind, error) => {
    const { api } = wire(() => json({ error }, status));
    expect(await markNoticeRead(ID, 1, api)).toEqual({ kind });
  });

  it.each([[{}], [{ readAt: "jučer" }], [{ readAt: AT, extra: true }], [{ readAt: "2026-02-31T09:00:00.000Z" }]])(
    "never claims a read mark on a reply the contract or the calendar refuses: %o",
    async (body) => {
      const { api } = wire(() => json(body));
      expect(await markNoticeRead(ID, 1, api)).toEqual({ kind: "unavailable" });
    },
  );

  it("treats a transport failure as unavailable", async () => {
    const { api } = wire(() => { throw new TypeError("offline"); });
    expect(await markNoticeRead(ID, 1, api)).toEqual({ kind: "unavailable" });
  });
});
