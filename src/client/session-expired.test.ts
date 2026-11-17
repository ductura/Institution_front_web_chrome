// DAN-1062 (1062-1): a 401 whose code is the catalogue's session_expired is
// kept as session_expired; everything else is exactly what the generated
// client gives (a differential test over the same Response). The fake server
// of @ductura/test-fakes 3.0.1 has no session_expired vector and no route of
// the contract lists the code (S-1D-d), so the answer is the wire shape of the
// fake server's own refusal: the status, application/json, {"error": code}.
// Valid input per route comes from the fake server's vectors.
import catalog from "@ductura/contracts/errors/catalog.json" with { type: "json" };
import { createClient, validateInput, type OperationId } from "@ductura/contracts";
import { VECTORS } from "@ductura/test-fakes/fake-server";
import { describe, expect, it } from "vitest";
import { createApi, RESPONSES, SESSION_EXPIRED_ENTRY, sessionExpiredEntry, type Input } from "./api";

const BASE = "http://fake.invalid";
type Answer = { status: number; type?: string; body?: string };

function respond(answer: Answer): typeof fetch {
  return () => {
    const headers = answer.type === undefined ? undefined : { "content-type": answer.type };
    const res = new Response(answer.body ?? null, { status: answer.status, headers });
    return Promise.resolve(res);
  };
}

/** The first vector input of each route that createApi sends. */
const INPUTS = new Map<OperationId, Input<OperationId>>();
for (const v of VECTORS) {
  const id = v.route as OperationId;
  const { params, query, body } = v.request;
  const input = { params, query, body } as Input<OperationId>;
  const sendable = v.request.rawBody === undefined && (["params", "query", "body"] as const).every((p) => validateInput(id, p, input[p]));
  if (sendable && !INPUTS.has(id)) INPUTS.set(id, input);
}
const covered = (id: string) => RESPONSES.get(id)?.["401"] !== undefined && !id.startsWith("auth.");
const ROUTES = [...INPUTS.keys()];
const json = (value: unknown): Answer => ({ status: 401, type: "application/json", body: JSON.stringify(value) });

async function both(id: OperationId, answer: Answer) {
  const input = INPUTS.get(id)!;
  const api = await createApi({ baseUrl: BASE, fetchImpl: respond(answer) })(id, input);
  const plain = await createClient(BASE, respond(answer))(id, input).catch(() => ({ ok: false, status: 0, code: "unexpected" }));
  return { api, plain };
}

describe("session_expired from the error catalogue (DAN-1062)", () => {
  it("reads one entry: 401, session_expired, clientErrors.sessionExpired", () => {
    expect(SESSION_EXPIRED_ENTRY).toEqual({ status: 401, code: "session_expired", messageKey: "clientErrors.sessionExpired" });
    expect(() => sessionExpiredEntry({ errors: [] })).toThrow();
    const twice = catalog.errors.filter((e) => e.code === "session_expired");
    expect(() => sessionExpiredEntry({ errors: [...catalog.errors, ...twice] })).toThrow();
    expect(() => sessionExpiredEntry({ errors: [{ status: 403, code: "session_expired", messageKey: "x" }] })).toThrow();
  });

  it("covers routes with 401 and leaves auth.* out", () => {
    expect(ROUTES.filter(covered).length).toBeGreaterThan(20);
    expect(ROUTES.some((id) => id.startsWith("auth.") && RESPONSES.get(id)?.["401"] !== undefined)).toBe(true);
  });

  // Negative cases first: each must equal the generated client's own answer.
  const NEGATIVE: [string, Answer][] = [
    ["unauthenticated", json({ error: "unauthenticated" })],
    ["unauthorized", json({ error: "unauthorized" })],
    ["no body", { status: 401 }],
    ...[400, 403, 404, 409, 429, 500, 503].map((status): [string, Answer] =>
      [`status ${status}`, { status, type: "application/json", body: '{"error":"session_expired"}' }]),
    ...["Session_Expired", "SESSION_EXPIRED", "session_expired ", " session_expired", "\tsession_expired", "session_expired\t",
      "session_expired ", " session_expired", "session_expired\u007f", "session_expired\r\n", "session-expired", ""]
      .map((code): [string, Answer] => [`look-alike ${JSON.stringify(code)}`, json({ error: code })]),
    ...[5, { a: "session_expired" }, ["session_expired"], null, true].map((code): [string, Answer] => [`non-string ${JSON.stringify(code)}`, json({ code })]),
    ["text/plain", { status: 401, type: "text/plain", body: "session_expired" }],
    ["Application/JSON", { status: 401, type: "Application/JSON", body: '{"error":"session_expired"}' }],
    ["problem+json", { status: 401, type: "application/problem+json", body: '{"error":"session_expired"}' }],
    ["broken JSON", { status: 401, type: "application/json", body: "session_expired" }],
    ["__proto__", { status: 401, type: "application/json", body: '{"__proto__":"session_expired"}' }],
    ["toString", json({ toString: "session_expired" })],
    ["constructor", json({ constructor: "session_expired" })],
    ["code first", json({ code: "unauthenticated", error: "session_expired" })],
  ];

  for (const id of ROUTES) {
    it(`${id}: every other answer is the generated client's`, async () => {
      for (const [, answer] of NEGATIVE) {
        const { api, plain } = await both(id, answer);
        expect(api).toEqual(plain);
        expect(api).not.toMatchObject({ code: "session_expired" });
      }
    });

    it(`${id}: session_expired ${covered(id) ? "is kept" : "is left to the generated client"}`, async () => {
      for (const body of [{ error: "session_expired" }, { code: "session_expired" }, { code: 5, error: "session_expired" }, { status: "session_expired" }]) {
        const { api, plain } = await both(id, json(body));
        expect(api).toEqual(covered(id) ? { ok: false, status: 401, code: "session_expired" } : plain);
      }
    });
  }

  it("refuses input that breaks the contract before sending, even when the answer would be session_expired", async () => {
    let sent = 0;
    const fetchImpl: typeof fetch = (...args) => { sent += 1; return respond(json({ error: "session_expired" }))(...args); };
    const result = await createApi({ baseUrl: BASE, fetchImpl })("student.assignments.get", { params: undefined, query: { x: "1" }, body: undefined } as never);
    expect(result).toEqual({ ok: false, status: 0, code: "client_rejected" });
    expect(sent).toBe(0);
  });
});
