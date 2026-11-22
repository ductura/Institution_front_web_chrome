// src/client/api (DAN-752): what the generated client lets through and the web
// does not. An unknown field, a wrong type or an undeclared answer is
// "unexpected"; input that breaks the contract never reaches the network.
import { VECTORS } from "@ductura/test-fakes/fake-server";
import { describe, expect, it, vi } from "vitest";
import { createApi } from "./api";

const NONE = { params: undefined, query: undefined, body: undefined } as const;

function answering(status: number, body: string | null, contentType = "application/json") {
  const fetchImpl = vi.fn<typeof fetch>(async () =>
    new Response(body, { status, headers: body === null ? {} : { "content-type": contentType } }));
  return { api: createApi({ baseUrl: "https://ductura.example.invalid", fetchImpl }), fetchImpl };
}

function vectorInput(route: string, name: string): never {
  const vector = VECTORS.find((v) => v.route === route && v.name === name);
  if (vector === undefined) throw new Error(`no vector ${name} for ${route}`);
  const { params, query, body } = structuredClone(vector.request);
  return { params, query, body } as never;
}

function vectorBody(route: string, status: number): Record<string, unknown> {
  const vector = VECTORS.find((v) => v.route === route && v.response.status === status);
  if (vector === undefined) throw new Error(`no ${status} vector for ${route}`);
  return structuredClone(vector.response.body) as Record<string, unknown>;
}

describe("src/client/api answers", () => {
  it("passes an answer that is exactly the contract", async () => {
    const { api } = answering(200, JSON.stringify({ status: "ok", version: "1.2.0" }));
    expect(await api("platform.health.get", NONE)).toMatchObject({ ok: true, status: 200, body: { status: "ok" } });
  });

  it("refuses an unknown top-level field", async () => {
    const { api } = answering(200, JSON.stringify({ status: "ok", extra: true }));
    expect(await api("platform.health.get", NONE)).toEqual({ ok: false, status: 200, code: "unexpected" });
  });

  it("refuses an unknown field deep inside a real answer", async () => {
    const body = vectorBody("evidence.open.post", 200);
    const keys = body.receiptKeys as Record<string, unknown>[];
    expect(keys.length).toBeGreaterThan(0);
    keys[0] = { ...keys[0], injected: "x" };
    const { api } = answering(200, JSON.stringify(body));
    const result = await api("evidence.open.post", { ...NONE, body: { assignmentId: "00000000-0000-4000-8000-0000000000a1" } });
    expect(result).toEqual({ ok: false, status: 200, code: "unexpected" });
  });

  it("refuses __proto__ smuggled as a field", async () => {
    const { api } = answering(200, '{"status":"ok","__proto__":{"polluted":true}}');
    expect(await api("platform.health.get", NONE)).toEqual({ ok: false, status: 200, code: "unexpected" });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("refuses a field of the wrong type or pattern", async () => {
    for (const version of [5, "1.2", null]) {
      const { api } = answering(200, JSON.stringify({ status: "ok", version }));
      expect(await api("platform.health.get", NONE)).toEqual({ ok: false, status: 200, code: "unexpected" });
    }
  });

  it("refuses a missing required field", async () => {
    const { api } = answering(200, "{}");
    expect(await api("platform.health.get", NONE)).toEqual({ ok: false, status: 200, code: "unexpected" });
  });

  it("refuses a success status the contract does not declare", async () => {
    const { api } = answering(201, JSON.stringify({ status: "ok" }));
    expect(await api("platform.health.get", NONE)).toEqual({ ok: false, status: 201, code: "unexpected" });
  });

  it("refuses a JSON body where the contract declares none, and none where it declares one", async () => {
    const withBody = answering(200, JSON.stringify({ any: 1 }));
    expect(await withBody.api("auth.backchannel-logout.post", { ...NONE, body: { logout_token: "izmisljeni" } }))
      .toEqual({ ok: false, status: 200, code: "unexpected" });
    const noJson = answering(200, "ok", "text/plain");
    expect(await noJson.api("platform.health.get", NONE)).toEqual({ ok: false, status: 200, code: "unexpected" });
  });

  it("refuses any body where the contract declares none, whatever its content type", async () => {
    const body = { logout_token: "izmisljeni" };
    for (const [text, type] of [["unexpected", "text/plain"], ["<p>x</p>", "text/html"], ["x", ""]] as const) {
      const fetchImpl = vi.fn<typeof fetch>(async () => {
        const res = new Response(text, { status: 200 });
        if (type === "") res.headers.delete("content-type");
        else res.headers.set("content-type", type);
        return res;
      });
      const api = createApi({ baseUrl: "https://ductura.example.invalid", fetchImpl });
      expect(await api("auth.backchannel-logout.post", { ...NONE, body })).toEqual({ ok: false, status: 200, code: "unexpected" });
    }
    const empty = answering(200, null);
    expect(await empty.api("auth.backchannel-logout.post", { ...NONE, body })).toMatchObject({ ok: true, status: 200 });
  });

  it("refuses a JSON content type with a body that is not JSON", async () => {
    const { api } = answering(200, "{not json");
    expect(await api("platform.health.get", NONE)).toEqual({ ok: false, status: 0, code: "unexpected" });
  });

  // WEB-ER (Ductus#2028 c.7020060555): only a 5xx keeps its status, so a caller can send the same request again.
  it.each([
    [500, 500], [502, 502], [503, 503], [599, 599], [201, 0], [400, 0], [401, 0], [409, 0], [499, 0],
  ])("an unreadable JSON body under HTTP %i is status %i", async (http, status) => {
    expect(await answering(http, "{not json").api("platform.health.get", NONE)).toEqual({ ok: false, status, code: "unexpected" });
    expect(await answering(http, "{not json").api("profile.me.get", NONE)).toEqual({ ok: false, status, code: "unexpected" });
  });

  it("an unreadable 5xx of a protocol route keeps no body", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response("{", { status: 503, headers: { "content-type": "application/json" } }));
    const api = createApi({ baseUrl: "https://ductura.example.invalid", fetchImpl, protocol: "2" });
    const input = vectorInput("evidence.commit.post", VECTORS.find((v) => v.route === "evidence.commit.post")!.name);
    const result = await api("evidence.commit.post", input);
    expect(result).toEqual({ ok: false, status: 503, code: "unexpected" });
    expect(Object.hasOwn(result, "body")).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("reads a contracted 409 answer and refuses one that breaks its schema", async () => {
    const input = vectorInput("live.document.put", "conflict");
    const token = "1b2c3d4e-5f60-4718-8293-a4b5c6d7e8fa";
    expect(await answering(409, JSON.stringify({ outcome: "conflict", token })).api("live.document.put", input))
      .toMatchObject({ ok: true, status: 409, body: { outcome: "conflict", token } });
    expect(await answering(409, JSON.stringify({ outcome: "conflict", token, extra: 1 })).api("live.document.put", input))
      .toEqual({ ok: false, status: 409, code: "unexpected" });
    expect(await answering(409, JSON.stringify({ error: "conflict", code: "conflict" })).api("live.document.put", input))
      .toEqual({ ok: false, status: 409, code: "unexpected" });
  });

  it("keeps a problem body on revision-requests 409 an error", async () => {
    const input = vectorInput("collaboration.revision-requests.post", "stale-counter");
    expect(await answering(409, JSON.stringify({ error: "not_allowed", code: "not_allowed" })).api("collaboration.revision-requests.post", input))
      .toEqual({ ok: false, status: 409, code: "not_allowed" });
  });

  it("never renames an unknown error code", async () => {
    const { api } = answering(503, JSON.stringify({ status: "made_up" }));
    expect(await api("platform.ready.get", NONE)).toEqual({ ok: false, status: 503, code: "unexpected" });
  });
});

describe("src/client/api input", () => {
  it("refuses an unknown field in the request body before the network", async () => {
    const { api, fetchImpl } = answering(200, JSON.stringify({ locale: "hr" }));
    const body = { locale: "hr", injected: true } as unknown as { locale: "hr" };
    expect(await api("profile.interface-locale.post", { ...NONE, body })).toEqual({ ok: false, status: 0, code: "client_rejected" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses a body on an operation without one, and an operation the contract does not have", async () => {
    const { api, fetchImpl } = answering(200, "{}");
    expect(await api("platform.health.get", { ...NONE, body: { x: 1 } as never })).toMatchObject({ code: "client_rejected" });
    expect(await api("comments.create.post" as never, NONE as never)).toMatchObject({ code: "client_rejected" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("checks and sends one copy: a getter cannot change the body after the check", async () => {
    const { api, fetchImpl } = answering(200, JSON.stringify({ locale: "hr" }));
    let reads = 0;
    const body = { get locale() { reads += 1; return reads === 1 ? "hr" : "xx"; } } as unknown as { locale: "hr" };
    await api("profile.interface-locale.post", { ...NONE, body });
    expect(reads).toBe(1);
    expect(fetchImpl.mock.calls[0]?.[1]?.body).toBe('{"locale":"hr"}');
  });

  it("refuses a body whose inherited toJSON would send other fields", async () => {
    const { api, fetchImpl } = answering(200, JSON.stringify({ locale: "hr" }));
    const body = Object.assign(Object.create({ toJSON: () => ({ locale: "xx", role: "admin" }) }) as object, { locale: "hr" });
    expect(await api("profile.interface-locale.post", { ...NONE, body: body as { locale: "hr" } })).toMatchObject({ code: "client_rejected" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends no query or form field the contract does not name, even where the server would accept it", async () => {
    const { api, fetchImpl } = answering(303, null);
    const query = { code: "c", state: "s", returnTo: "https://zlo.example.invalid" } as unknown as { code: string };
    expect(await api("auth.callback.get", { ...NONE, query })).toMatchObject({ code: "client_rejected" });
    const body = { logout_token: "izmisljeni", extra: "x" };
    expect(await api("auth.backchannel-logout.post", { ...NONE, body })).toMatchObject({ code: "client_rejected" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends a query only for a migration operation whose contract has a query schema (WEB-2007)", async () => {
    const reply = JSON.stringify({ from: 1, to: 2, blocks: [] });
    const { api, fetchImpl } = answering(200, reply);
    const params = { documentId: "izmišljeni-rad" };
    expect(await api("work.compare.get", { params, query: { from: "1", to: "2" }, body: undefined })).toMatchObject({ ok: true });
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain("/works/" + encodeURIComponent("izmišljeni-rad") + "/compare?from=1&to=2");
    const refused = [
      { from: "1" }, { from: "1", to: "2", extra: "x" }, { from: "0", to: "2" }, { from: "1", to: "2 " }, undefined,
    ];
    for (const query of refused) {
      expect(await api("work.compare.get", { params, query: query as never, body: undefined })).toMatchObject({ code: "client_rejected" });
    }
    // An operation without a query schema still refuses any query.
    expect(await api("work.versions.get", { params, query: { x: "1" } as never, body: undefined })).toMatchObject({ code: "client_rejected" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("refuses a body field no branch of an anyOf body names", async () => {
    const { api, fetchImpl } = answering(200, "{}");
    const input = vectorInput("collaboration.revision-requests.post", "stale-counter") as { params: unknown; body: Record<string, unknown> };
    expect(await api("collaboration.revision-requests.post", { ...input, body: { ...input.body, injected: 1 } } as never))
      .toEqual({ ok: false, status: 0, code: "client_rejected" });
    expect(await api("collaboration.revision-requests.post", { ...input, body: { ...input.body, documentId: "x" } } as never))
      .toEqual({ ok: false, status: 0, code: "client_rejected" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends the open live document body, whose field names the contract leaves free", async () => {
    const { api, fetchImpl } = answering(200, JSON.stringify({ outcome: "accepted", token: "1b2c3d4e-5f60-4718-8293-a4b5c6d7e8fa" }));
    expect(await api("live.document.put", vectorInput("live.document.put", "accepted"))).toMatchObject({ ok: true, status: 200 });
    expect(String(fetchImpl.mock.calls[0]?.[1]?.body)).toContain('"schemaVersion":1');
  });

  it("refuses input that cannot be copied as JSON", async () => {
    const { api, fetchImpl } = answering(200, "{}");
    const body: Record<string, unknown> = { locale: "hr" };
    body.self = body;
    expect(await api("profile.interface-locale.post", { ...NONE, body: body as { locale: "hr" } })).toMatchObject({ code: "client_rejected" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends to the given origin only, on the contracted path", async () => {
    const { api, fetchImpl } = answering(200, JSON.stringify({ status: "ok" }));
    await api("platform.health.get", NONE);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe("https://ductura.example.invalid/api/v1/health");
  });
});
