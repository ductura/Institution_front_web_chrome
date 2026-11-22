// Every vector of the contract, through the generated client, against the fake
// server from @ductura/test-fakes (DAN-752). The transport adds what a browser
// or a hostile caller adds and the generated client cannot (cookie, Origin,
// Sec-Fetch-Site, ductus-protocol, a raw body) and names the vector, so each
// vector gets exactly its own answer. A vector with its own Content-Length
// (a framing fault: invalid, mismatched, slow or broken body) cannot be sent
// by fetch, which owns that header; it goes to the same fake server in process
// (answerFake) with the exact header and bytes.
import type { AddressInfo } from "node:net";
import { createClient, validateInput, type OperationId } from "@ductura/contracts";
import { answerFake, createFakeServer, FAKE_VECTOR_HEADER, ROUTE_TABLE, VECTORS, type FakeVector } from "@ductura/test-fakes/fake-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { acceptedByExtract, AHEAD_OF_PACKAGE, createApi, RESPONSES, type Input } from "./api";
import migrationVectors from "./migration-contract-vectors.generated.json" with { type: "json" };

const server = createFakeServer();
let baseUrl = "";

beforeAll(async () => {
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((done) => server.close(() => done())));

function transport(vector: FakeVector, sent: { count: number }): typeof fetch {
  return (input, init) => {
    sent.count += 1;
    const headers = new Headers(init?.headers);
    for (const [name, value] of Object.entries(vector.request.headers ?? {})) {
      if (name !== "content-length") headers.set(name, value);
    }
    headers.set(FAKE_VECTOR_HEADER, vector.name);
    const body = vector.request.rawBody ?? init?.body;
    const length = vector.request.headers?.["content-length"];
    if (length === undefined) return fetch(input, { ...init, headers, body });
    const fake: Record<string, string> = Object.fromEntries(headers);
    fake["content-length"] = length;
    const answer = answerFake({
      method: init?.method ?? "GET",
      url: String(input),
      headers: fake,
      body: new TextEncoder().encode(typeof body === "string" ? body : ""),
    });
    return Promise.resolve(new Response(answer.body === "" ? null : answer.body, {
      status: answer.status,
      headers: Object.entries(answer.headers).flatMap(([n, v]) => (Array.isArray(v) ? v : [v]).map((x) => [n, x] as [string, string])),
    }));
  };
}

function inputOf(vector: FakeVector): Input<OperationId> {
  const { params, query, body } = vector.request;
  return { params, query, body } as Input<OperationId>;
}

function sentCode(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const fields = body as { code?: unknown; error?: unknown; status?: unknown };
  return [fields.code, fields.error, fields.status].find((v): v is string => typeof v === "string");
}

/** Statuses of 400 and above that the contract reads as an answer, not an error (2.0.0). */
const ANSWERS: readonly string[] = ["collaboration.revision-requests.post 409", "live.document.put 409"];

function isAnswer(vector: FakeVector): boolean {
  const { status, body } = vector.response;
  if (status < 400) return true;
  return ANSWERS.includes(`${vector.route} ${status}`) && typeof body === "object" && body !== null
    && !Array.isArray(body) && !("error" in body) && !("code" in body);
}

function expectAnswer(vector: FakeVector, result: { ok: boolean; status: number; code?: string; body?: unknown }): void {
  const { status, body, contentType } = vector.response;
  expect(result.status).toBe(status);
  if (isAnswer(vector)) {
    expect(result.ok).toBe(true);
    expect(result.body).toEqual(contentType?.startsWith("application/json") ? body : undefined);
    return;
  }
  expect(result.ok).toBe(false);
  // Every contracted error is understood: never "unexpected" for a vector.
  expect(result.code).not.toBe("unexpected");
  const named = sentCode(body);
  if (named !== undefined) expect(result.code).toBe(named);
}

// Added by contracts 2.7.0 and 2.8.0; @ductura/test-fakes 3.0.1 has no vectors for them.
const NO_VECTORS_YET: readonly string[] = ["downloads.manifest.get", "student.assignment-work.get"];

describe("contract vectors through the generated client", () => {
  it("has vectors for every operation of the contract and nothing else", () => {
    const routes = new Set(VECTORS.map((v) => v.route));
    const tableRoutes = Object.keys(ROUTE_TABLE);
    expect([...routes].sort()).toEqual([...tableRoutes].sort());
    // The contract may be ahead of test-fakes only by the named operations.
    const allRoutes = new Set([...tableRoutes, ...NO_VECTORS_YET, ...migrationVectors.map((vector) => vector.route)]);
    expect([...RESPONSES.keys()].sort()).toEqual([...allRoutes].sort());
    for (const r of NO_VECTORS_YET) expect(routes.has(r)).toBe(false);
  });

  it("has an answer vector for every contracted answer of 400 and above", () => {
    // Both ways: expectAnswer below fails when the generated client reads any
    // other vector of 400 and above as ok, or one of these as an error.
    const answered = VECTORS.filter((v) => v.response.status >= 400 && isAnswer(v));
    expect([...new Set(answered.map((v) => `${v.route} ${v.response.status}`))].sort()).toEqual([...ANSWERS]);
  });

  for (const vector of VECTORS) {
    const id = vector.route as OperationId;
    const input = inputOf(vector);
    // The package is behind the server on a few operations (AHEAD_OF_PACKAGE): api sends what the extract accepts.
    const sendable = vector.request.rawBody === undefined
      && ((["params", "query", "body"] as const).every((part) => validateInput(id, part, input[part])) || (AHEAD_OF_PACKAGE.has(vector.route) && acceptedByExtract(vector.route, input)));

    it(`${vector.route} ${vector.name}: the generated client reads the answer`, async () => {
      const sent = { count: 0 };
      const result = await createClient(baseUrl, transport(vector, sent))(id, input);
      expect(sent.count).toBe(1);
      expectAnswer(vector, result as never);
    });

    it(`${vector.route} ${vector.name}: src/client/api ${sendable ? "accepts the answer" : "refuses before sending"}`, async () => {
      const sent = { count: 0 };
      const result = await createApi({ baseUrl, fetchImpl: transport(vector, sent) })(id, input);
      if (!sendable) {
        expect(result).toEqual({ ok: false, status: 0, code: "client_rejected" });
        expect(sent.count).toBe(0);
        return;
      }
      expect(sent.count).toBe(1);
      expectAnswer(vector, result as never);
    });
  }
});
