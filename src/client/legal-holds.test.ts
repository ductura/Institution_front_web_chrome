// WEB-1301, LOK-WEB-4: legal holds in the server's shape over a stub transport answering with invented data.
import { describe, expect, it, vi } from "vitest";
import contractVectors from "./migration-contract-vectors.generated.json" with { type: "json" };
import { fetchLegalHolds, placeLegalHold, releaseLegalHold } from "./legal-holds";

const BASE = "https://ductura.example.invalid";
const ID = "b1301000-0000-4000-8000-000000000001";
const ID2 = "b1301000-0000-4000-8000-000000000002";
const STUDENT = "c1301000-0000-4000-8000-000000000001";
const PLACER = "d1301000-0000-4000-8000-000000000001";
const RELEASER = "d1301000-0000-4000-8000-000000000002";
const reply = (status: number, body: unknown) => vi.fn(async (_url: URL | RequestInfo, _init?: RequestInit) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
const error = (code: string) => ({ error: code, code, messageKey: `errors.${code}`, status: 0 });
const ACTIVE = { holdId: ID, subjectType: "student", subjectId: STUDENT, caseReference: "IZM-2026-001", placedBy: PLACER, placedAt: "2026-11-20T09:00:00.000Z", releasedBy: null, releasedAt: null };
const RELEASED = { ...ACTIVE, holdId: ID2, caseReference: "IZM-2026-000", releasedBy: RELEASER, releasedAt: "2026-11-21T10:00:00.000Z" };
const INPUT = { subjectType: "student" as const, subjectId: STUDENT, caseReference: "IZM-2026-002" };

describe("fetchLegalHolds", () => {
  it("reads the server's shape and keeps only the active holds, without who placed them", async () => {
    const fetchImpl = reply(200, { holds: [ACTIVE, RELEASED] });
    expect(await fetchLegalHolds({ baseUrl: BASE, fetchImpl })).toEqual({ kind: "ok", holds: [
      { id: ID, subjectType: "student", subjectId: STUDENT, caseReference: "IZM-2026-001", placedAt: "2026-11-20T09:00:00.000Z" },
    ] });
    expect(String(fetchImpl.mock.calls[0]![0])).toBe(`${BASE}/api/v1/institution/legal-holds`);
  });

  it("reads the contract's ready vector", async () => {
    const vector = contractVectors.find((v) => v.route === "institution.legal-holds.get" && v.name === "ready")!;
    const out = await fetchLegalHolds({ baseUrl: BASE, fetchImpl: reply(200, vector.response.body) });
    expect(out.kind === "ok" ? out.holds.map((h) => h.caseReference) : out.kind).toEqual(["IZM-2026-001"]);
  });

  it("maps 401, 403 and 503", async () => {
    expect(await fetchLegalHolds({ baseUrl: BASE, fetchImpl: reply(401, error("unauthorized")) })).toEqual({ kind: "signedOut" });
    expect(await fetchLegalHolds({ baseUrl: BASE, fetchImpl: reply(403, error("forbidden")) })).toEqual({ kind: "denied" });
    expect(await fetchLegalHolds({ baseUrl: BASE, fetchImpl: reply(503, error("unavailable")) })).toEqual({ kind: "unavailable" });
  });

  it("maps the provisional shape, a hold twice and a half-released hold to unavailable", async () => {
    const answers = [
      { holds: [{ id: ID, subject: "Izmišljeni kolegij za test", caseReference: "IZM-2026-001", placedAt: "2026-11-20T09:00:00.000Z", placedByName: "Ana Izmišljena", own: true }] },
      { holds: [ACTIVE, ACTIVE] },
      { holds: [{ ...ACTIVE, releasedBy: RELEASER }] },
      { holds: [{ ...ACTIVE, releasedAt: "2026-11-21T10:00:00.000Z" }] },
      { holds: [{ ...ACTIVE, holdId: ID.toUpperCase() }] },
    ];
    for (const body of answers) expect(await fetchLegalHolds({ baseUrl: BASE, fetchImpl: reply(200, body) })).toEqual({ kind: "unavailable" });
  });
});

describe("placeLegalHold", () => {
  it("sends the subject type, the trimmed subject id and case reference as JSON and nothing else", async () => {
    const fetchImpl = reply(201, { holdId: ID });
    const out = await placeLegalHold({ subjectType: "work", subjectId: " rad-izm-1 ", caseReference: " IZM-2026-002 " }, { baseUrl: BASE, fetchImpl });
    expect(out).toEqual({ kind: "ok" });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(`${BASE}/api/v1/institution/legal-holds`);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ subjectType: "work", subjectId: "rad-izm-1", caseReference: "IZM-2026-002" });
  });

  it("maps the refusals, with 404 as a subject the institution does not have", async () => {
    expect(await placeLegalHold(INPUT, { baseUrl: BASE, fetchImpl: reply(403, error("forbidden")) })).toEqual({ kind: "denied" });
    expect(await placeLegalHold(INPUT, { baseUrl: BASE, fetchImpl: reply(404, error("not_found")) })).toEqual({ kind: "missingSubject" });
    expect(await placeLegalHold(INPUT, { baseUrl: BASE, fetchImpl: reply(422, error("invalid_input")) })).toEqual({ kind: "invalid" });
    expect(await placeLegalHold(INPUT, { baseUrl: BASE, fetchImpl: reply(503, error("unavailable")) })).toEqual({ kind: "unavailable" });
  });

  it("does not send a value the contract refuses", async () => {
    const fetchImpl = reply(201, { holdId: ID });
    expect(await placeLegalHold({ ...INPUT, subjectId: " " }, { baseUrl: BASE, fetchImpl })).toEqual({ kind: "invalid" });
    expect(await placeLegalHold({ ...INPUT, caseReference: "x".repeat(121) }, { baseUrl: BASE, fetchImpl })).toEqual({ kind: "invalid" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("releaseLegalHold", () => {
  it("sends the reason to the hold's release route", async () => {
    const fetchImpl = reply(200, { holdId: ID, releasedAt: "2026-11-21T10:00:00.000Z" });
    expect(await releaseLegalHold(ID, " Slučaj je zatvoren. ", { baseUrl: BASE, fetchImpl })).toEqual({ kind: "ok" });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(`${BASE}/api/v1/institution/legal-holds/${ID}/release`);
    expect(JSON.parse(String(init?.body))).toEqual({ reason: "Slučaj je zatvoren." });
  });

  it("allows a reason up to 600 characters", async () => {
    const fetchImpl = reply(200, { holdId: ID, releasedAt: "2026-11-21T10:00:00.000Z" });
    expect(await releaseLegalHold(ID, "r".repeat(600), { baseUrl: BASE, fetchImpl })).toEqual({ kind: "ok" });
  });

  it("maps 403 (own hold) to denied and 404/409 to stale", async () => {
    expect(await releaseLegalHold(ID, "Razlog", { baseUrl: BASE, fetchImpl: reply(403, error("forbidden")) })).toEqual({ kind: "denied" });
    expect(await releaseLegalHold(ID, "Razlog", { baseUrl: BASE, fetchImpl: reply(404, error("not_found")) })).toEqual({ kind: "stale" });
    expect(await releaseLegalHold(ID, "Razlog", { baseUrl: BASE, fetchImpl: reply(409, error("conflict")) })).toEqual({ kind: "stale" });
  });
});
