// WEB-1301: the data classes read over a stub transport answering with invented data.
import { describe, expect, it, vi } from "vitest";
import { fetchRetention } from "./retention";

const BASE = "https://ductura.example.invalid";
const reply = (status: number, body: unknown) => vi.fn(async (_url: URL | RequestInfo, _init?: RequestInit) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
const error = (code: string) => ({ error: code, code, messageKey: `errors.${code}`, status: 0 });
const CLASSES = { classes: [
  { classId: "DATA-CLASS-01", name: "Izmišljeni radni tekst", retentionDays: 365, mode: "delete" },
  { classId: "DATA-CLASS-02", name: "Izmišljeni zapis pristupa", retentionDays: null, mode: "dry_run" },
] };

describe("fetchRetention", () => {
  it("reads the classes, with a null period kept as null", async () => {
    const fetchImpl = reply(200, CLASSES);
    expect(await fetchRetention({ baseUrl: BASE, fetchImpl })).toEqual({ kind: "ok", classes: CLASSES.classes });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(`${BASE}/api/v1/institution/retention`);
    expect(init?.method).toBe("GET");
  });

  it("reads an empty list", async () => {
    expect(await fetchRetention({ baseUrl: BASE, fetchImpl: reply(200, { classes: [] }) })).toEqual({ kind: "ok", classes: [] });
  });

  it("maps 401 to signedOut and 403 to denied", async () => {
    expect(await fetchRetention({ baseUrl: BASE, fetchImpl: reply(401, error("unauthorized")) })).toEqual({ kind: "signedOut" });
    expect(await fetchRetention({ baseUrl: BASE, fetchImpl: reply(403, error("forbidden")) })).toEqual({ kind: "denied" });
  });

  it("maps 503, a thrown transport and a body that breaks the contract to unavailable", async () => {
    expect(await fetchRetention({ baseUrl: BASE, fetchImpl: reply(503, error("unavailable")) })).toEqual({ kind: "unavailable" });
    expect(await fetchRetention({ baseUrl: BASE, fetchImpl: vi.fn(async () => { throw new Error("offline"); }) })).toEqual({ kind: "unavailable" });
    const unknownField = { classes: [{ ...CLASSES.classes[0]!, extra: true }] };
    expect(await fetchRetention({ baseUrl: BASE, fetchImpl: reply(200, unknownField) })).toEqual({ kind: "unavailable" });
    const badMode = { classes: [{ ...CLASSES.classes[0]!, mode: "purge" }] };
    expect(await fetchRetention({ baseUrl: BASE, fetchImpl: reply(200, badMode) })).toEqual({ kind: "unavailable" });
  });
});
