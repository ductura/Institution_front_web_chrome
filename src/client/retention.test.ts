// WEB-1301, LOK-WEB-3: the data classes read over a stub transport answering with invented data.
import { describe, expect, it, vi } from "vitest";
import contractVectors from "./migration-contract-vectors.generated.json" with { type: "json" };
import { fetchRetention } from "./retention";

const BASE = "https://ductura.example.invalid";
const reply = (status: number, body: unknown) => vi.fn(async (_url: URL | RequestInfo, _init?: RequestInit) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
const error = (code: string) => ({ error: code, code, messageKey: `errors.${code}`, status: 0 });
const VERSIONS = { key: "versions", label: "retention.versions", retentionDays: 365, mode: "execute", candidates: 12, lastRunAt: "2026-11-20T03:00:00.000Z" };
const ACCESS_LOG = { key: "access-log", label: "retention.accessLog", retentionDays: null, mode: "dry-run", candidates: 0, lastRunAt: null };
const RECEIPTS = { key: "receipts", label: "retention.receipts", retentionDays: null, mode: "dry-run", candidates: null, lastRunAt: null };
const CLASSES = { classes: [VERSIONS, ACCESS_LOG] };

describe("fetchRetention", () => {
  it("reads the classes in the server's shape, with execute as delete and dry-run as dry_run", async () => {
    const fetchImpl = reply(200, CLASSES);
    expect(await fetchRetention({ baseUrl: BASE, fetchImpl })).toEqual({ kind: "ok", classes: [
      { key: "versions", retentionDays: 365, mode: "delete", candidates: 12, lastRunAt: "2026-11-20T03:00:00.000Z" },
      { key: "access-log", retentionDays: null, mode: "dry_run", candidates: 0, lastRunAt: null },
    ] });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(`${BASE}/api/v1/institution/retention`);
    expect(init?.method).toBe("GET");
  });

  it("reads the contract's ready vector", async () => {
    const vector = contractVectors.find((v) => v.route === "institution.retention.get" && v.name === "dry-run")!;
    const out = await fetchRetention({ baseUrl: BASE, fetchImpl: reply(200, vector.response.body) });
    expect(out.kind).toBe("ok");
    expect(out.kind === "ok" ? out.classes.map((c) => c.key) : []).toEqual(["sessions", "live-state", "versions", "change-times", "access-log", "receipts"]);
  });

  it("reads an empty list and a class without storage (null candidates)", async () => {
    expect(await fetchRetention({ baseUrl: BASE, fetchImpl: reply(200, { classes: [] }) })).toEqual({ kind: "ok", classes: [] });
    const out = await fetchRetention({ baseUrl: BASE, fetchImpl: reply(200, { classes: [RECEIPTS] }) });
    expect(out).toEqual({ kind: "ok", classes: [{ key: "receipts", retentionDays: null, mode: "dry_run", candidates: null, lastRunAt: null }] });
  });

  it("maps 401 to signedOut and 403 to denied", async () => {
    expect(await fetchRetention({ baseUrl: BASE, fetchImpl: reply(401, error("unauthorized")) })).toEqual({ kind: "signedOut" });
    expect(await fetchRetention({ baseUrl: BASE, fetchImpl: reply(403, error("forbidden")) })).toEqual({ kind: "denied" });
  });

  it("maps 503, a thrown transport and a body that breaks the contract to unavailable", async () => {
    expect(await fetchRetention({ baseUrl: BASE, fetchImpl: reply(503, error("unavailable")) })).toEqual({ kind: "unavailable" });
    expect(await fetchRetention({ baseUrl: BASE, fetchImpl: vi.fn(async () => { throw new Error("offline"); }) })).toEqual({ kind: "unavailable" });
    const broken = [
      { ...VERSIONS, extra: true },
      { ...VERSIONS, mode: "delete" },
      { ...VERSIONS, key: "drafts" },
      { ...VERSIONS, retentionDays: 0 },
      { key: "versions", label: "retention.versions", retentionDays: 365, mode: "execute" },
      // The provisional shape of WEB-1301.
      { classId: "DATA-CLASS-01", name: "Izmišljeni radni tekst", retentionDays: 365, mode: "delete" },
    ];
    for (const row of broken) {
      expect(await fetchRetention({ baseUrl: BASE, fetchImpl: reply(200, { classes: [row] }) })).toEqual({ kind: "unavailable" });
    }
  });

  it("maps a class twice and a class without a period that deletes to unavailable", async () => {
    expect(await fetchRetention({ baseUrl: BASE, fetchImpl: reply(200, { classes: [VERSIONS, VERSIONS] }) })).toEqual({ kind: "unavailable" });
    const deletesUndecided = { ...ACCESS_LOG, mode: "execute" };
    expect(await fetchRetention({ baseUrl: BASE, fetchImpl: reply(200, { classes: [deletesUndecided] }) })).toEqual({ kind: "unavailable" });
  });
});
