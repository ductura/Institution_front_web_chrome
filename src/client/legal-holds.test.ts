// WEB-1301: legal holds over a stub transport answering with invented data.
import { describe, expect, it, vi } from "vitest";
import { fetchLegalHolds, placeLegalHold, releaseLegalHold } from "./legal-holds";

const BASE = "https://ductura.example.invalid";
const ID = "b1301000-0000-4000-8000-000000000001";
const reply = (status: number, body: unknown) => vi.fn(async (_url: URL | RequestInfo, _init?: RequestInit) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
const error = (code: string) => ({ error: code, code, messageKey: `errors.${code}`, status: 0 });
const HOLDS = { holds: [{ id: ID, subject: "Izmišljeni kolegij za test", caseReference: "IZM-2026-001", placedAt: "2026-11-20T09:00:00.000Z", placedByName: "Ana Izmišljena", own: true }] };

describe("fetchLegalHolds", () => {
  it("reads the holds", async () => {
    const fetchImpl = reply(200, HOLDS);
    expect(await fetchLegalHolds({ baseUrl: BASE, fetchImpl })).toEqual({ kind: "ok", holds: HOLDS.holds });
    expect(String(fetchImpl.mock.calls[0]![0])).toBe(`${BASE}/api/v1/institution/legal-holds`);
  });

  it("maps 401, 403 and 503", async () => {
    expect(await fetchLegalHolds({ baseUrl: BASE, fetchImpl: reply(401, error("unauthorized")) })).toEqual({ kind: "signedOut" });
    expect(await fetchLegalHolds({ baseUrl: BASE, fetchImpl: reply(403, error("forbidden")) })).toEqual({ kind: "denied" });
    expect(await fetchLegalHolds({ baseUrl: BASE, fetchImpl: reply(503, error("unavailable")) })).toEqual({ kind: "unavailable" });
  });
});

describe("placeLegalHold", () => {
  it("sends the trimmed subject and case reference as JSON and nothing else", async () => {
    const fetchImpl = reply(201, { id: ID });
    expect(await placeLegalHold({ subject: "  Izmišljeni kolegij ", caseReference: " IZM-2026-002 " }, { baseUrl: BASE, fetchImpl })).toEqual({ kind: "ok" });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(`${BASE}/api/v1/institution/legal-holds`);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ subject: "Izmišljeni kolegij", caseReference: "IZM-2026-002" });
  });

  it("maps the refusals", async () => {
    const input = { subject: "Izmišljeni kolegij", caseReference: "IZM-2026-002" };
    expect(await placeLegalHold(input, { baseUrl: BASE, fetchImpl: reply(403, error("forbidden")) })).toEqual({ kind: "denied" });
    expect(await placeLegalHold(input, { baseUrl: BASE, fetchImpl: reply(422, error("invalid_input")) })).toEqual({ kind: "invalid" });
    expect(await placeLegalHold(input, { baseUrl: BASE, fetchImpl: reply(503, error("unavailable")) })).toEqual({ kind: "unavailable" });
  });

  it("does not send a value the contract refuses", async () => {
    const fetchImpl = reply(201, { id: ID });
    expect(await placeLegalHold({ subject: " ", caseReference: "x" }, { baseUrl: BASE, fetchImpl })).toEqual({ kind: "invalid" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("releaseLegalHold", () => {
  it("sends the reason to the hold's release route", async () => {
    const fetchImpl = reply(200, { id: ID, releasedAt: "2026-11-21T10:00:00.000Z" });
    expect(await releaseLegalHold(ID, " Slučaj je zatvoren. ", { baseUrl: BASE, fetchImpl })).toEqual({ kind: "ok" });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(`${BASE}/api/v1/institution/legal-holds/${ID}/release`);
    expect(JSON.parse(String(init?.body))).toEqual({ reason: "Slučaj je zatvoren." });
  });

  it("maps 403 (own hold) to denied and 404/409 to stale", async () => {
    expect(await releaseLegalHold(ID, "Razlog", { baseUrl: BASE, fetchImpl: reply(403, error("forbidden")) })).toEqual({ kind: "denied" });
    expect(await releaseLegalHold(ID, "Razlog", { baseUrl: BASE, fetchImpl: reply(404, error("not_found")) })).toEqual({ kind: "stale" });
    expect(await releaseLegalHold(ID, "Razlog", { baseUrl: BASE, fetchImpl: reply(409, error("conflict")) })).toEqual({ kind: "stale" });
  });
});
