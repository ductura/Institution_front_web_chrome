// ApiOptions.protocol (Ductus#2028, w1119h): createApi sends ductus-protocol to
// the evidence routes, the submission and the live read, which the contract's RequestSpec does
// not carry yet, and keeps an error body the contract declares (409 stale_base
// carries the work's state). Every vector of those routes runs on the fake
// server from @ductura/test-fakes with the header coming from createApi alone.
import type { AddressInfo } from "node:net";
import { validateInput, type OperationId } from "@ductura/contracts";
import { createFakeServer, FAKE_VECTOR_HEADER, VECTORS, type FakeVector } from "@ductura/test-fakes/fake-server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApi, errorBody, PROTOCOL_ROUTES, type Input, type ProtocolVersion } from "./api";

const server = createFakeServer();
let baseUrl = "";

beforeAll(async () => {
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((done) => server.close(() => done())));

const inputOf = (vector: FakeVector) => {
  const { params, query, body } = structuredClone(vector.request);
  return { params, query, body } as Input<OperationId>;
};

/** What a browser adds (cookie, Origin, Sec-Fetch-Site), never ductus-protocol: that comes from createApi. */
function browser(vector: FakeVector, seen: (string | null)[]): typeof fetch {
  return (input, init) => {
    const headers = new Headers(init?.headers);
    seen.push(headers.get("ductus-protocol"));
    for (const [name, value] of Object.entries(vector.request.headers ?? {})) {
      if (name !== "ductus-protocol" && name !== "content-length") headers.set(name, value);
    }
    headers.set(FAKE_VECTOR_HEADER, vector.name);
    return fetch(input, { ...init, headers });
  };
}

const NONE = { params: undefined, query: undefined, body: undefined } as const;
const OPEN = { ...NONE, body: { assignmentId: "00000000-0000-4000-8000-0000000000a1" } };
const STALE = { status: "stale_base", currentRevision: 3, documentHash: "a".repeat(64), headSegmentHash: null, lastSequenceTo: 7 };

function answering(status: number, body: unknown) {
  const fetchImpl = vi.fn<typeof fetch>(async () =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
  return { fetchImpl, base: { baseUrl: "https://ductura.example.invalid", fetchImpl } };
}
const sentProtocol = (fetchImpl: ReturnType<typeof answering>["fetchImpl"]) =>
  new Headers(fetchImpl.mock.calls[0]?.[1]?.headers).get("ductus-protocol");

describe("ApiOptions.protocol", () => {
  it("is exactly the routes whose vectors send ductus-protocol", () => {
    const withHeader = new Set(VECTORS.filter((v) => v.request.headers?.["ductus-protocol"] !== undefined).map((v) => v.route));
    expect([...PROTOCOL_ROUTES].sort()).toEqual([...withHeader].sort());
  });

  it("sends the header to a protocol route and keeps the content type", async () => {
    const { fetchImpl, base } = answering(200, {});
    await createApi({ ...base, protocol: "2" })("evidence.open.post", OPEN);
    expect(sentProtocol(fetchImpl)).toBe("2");
    expect(new Headers(fetchImpl.mock.calls[0]?.[1]?.headers).get("content-type")).toBe("application/json");
  });

  it("never sends it to any other route, nor without the option", async () => {
    const other = answering(200, { status: "ok" });
    await createApi({ ...other.base, protocol: "1" })("platform.health.get", NONE);
    expect(sentProtocol(other.fetchImpl)).toBeNull();
    const without = answering(200, {});
    await createApi(without.base)("evidence.open.post", OPEN);
    expect(sentProtocol(without.fetchImpl)).toBeNull();
  });

  it("keeps an error body the contract declares, only with the option", async () => {
    const body = { documentId: "d", clientTransactionId: "t", baseRevision: 2, segments: ["AAAA"], document: "AAAA" };
    const kept = await createApi({ ...answering(409, STALE).base, protocol: "2" })("evidence.commit.post", { ...NONE, body });
    expect(kept).toMatchObject({ ok: false, status: 409, code: "stale_base" });
    expect(errorBody(kept)).toEqual(STALE);
    const plain = await createApi(answering(409, STALE).base)("evidence.commit.post", { ...NONE, body });
    expect(plain).toEqual({ ok: false, status: 409, code: "stale_base" });
    expect(errorBody(plain)).toBeUndefined();
  });

  it("drops an error body the contract does not declare", async () => {
    const body = { documentId: "d", clientTransactionId: "t", baseRevision: 2, segments: ["AAAA"], document: "AAAA" };
    const extra = await createApi({ ...answering(409, { ...STALE, extra: 1 }).base, protocol: "2" })("evidence.commit.post", { ...NONE, body });
    expect(extra).toEqual({ ok: false, status: 409, code: "stale_base" });
    const success = await createApi({ ...answering(200, { status: "opened" }).base, protocol: "1" })("evidence.open.post", OPEN);
    expect(errorBody(success)).toBeUndefined();
  });
});

describe("the protocol routes' vectors on the fake server, the header from createApi", () => {
  const vectors = VECTORS.filter((v) => PROTOCOL_ROUTES.has(v.route) && v.request.rawBody === undefined
    && v.request.headers?.["content-length"] === undefined && v.request.headers?.["ductus-protocol"] !== undefined
    && (["params", "query", "body"] as const).every((part) => validateInput(v.route as OperationId, part, inputOf(v)[part])));

  it("covers every protocol route", () => {
    expect(new Set(vectors.map((v) => v.route))).toEqual(PROTOCOL_ROUTES);
  });

  for (const vector of vectors) {
    it(`${vector.route} ${vector.name}`, async () => {
      const seen: (string | null)[] = [];
      const protocol = vector.request.headers?.["ductus-protocol"] as ProtocolVersion;
      const result = await createApi({ baseUrl, fetchImpl: browser(vector, seen), protocol })(vector.route as OperationId, inputOf(vector));
      expect(seen).toEqual([protocol]);
      const { status, body } = vector.response;
      expect(result.status).toBe(status);
      if (status < 400) {
        expect(result).toMatchObject({ ok: true, body });
        return;
      }
      expect(result.ok).toBe(false);
      // The code as the generated client reads it: code, then error, then status.
      const fields = body as { code?: unknown; error?: unknown; status?: unknown };
      const named = [fields.code, fields.error, fields.status].find((value) => typeof value === "string");
      expect((result as { code: string }).code).toBe(named);
      expect(errorBody(result)).toEqual(body);
    });
  }
});
