import { describe, expect, it, vi } from "vitest";

import { createApi } from "./api";
import {
  hasSubmissions, merlinCsvPath, merlinDownloadPath, newRequestKey, packageView,
  readMerlinPackage, readMerlinRoster, requestMerlinPackage, type MerlinRow,
} from "./merlin-export";

// Every id, name, date and digest below is invented.
const BASE_URL = "https://ductura.example.invalid";
const A = "00000000-0000-4000-8000-0000000000a1";
const P = "00000000-0000-4000-8000-0000000000b1";
const KEY = "4b1e2c3d-0000-4000-8000-00000000aaa1";
const ZIP = "3f9a1c0e5b7d2a4c6e8f0a1b3c5d7e9f1a2b3c4d5e6f708192a3b4c5d6e7f809";
const EXPIRES = "2026-11-22T09:15:00.000Z";
const NONE = { submittedMinute: null, afterDeadline: null, pdfName: null, pdfSha256: null, docxName: null, docxSha256: null };
const ROWS: MerlinRow[] = [
  { familyName: "Anić", givenName: "Demo", submitted: true, submittedMinute: "2026-12-20T21:14:00.000Z", afterDeadline: false,
    pdfName: "anic-demo-000000e1.pdf", pdfSha256: "a".repeat(64), docxName: "anic-demo-000000e1.docx", docxSha256: "b".repeat(64) },
  { familyName: "Čolić", givenName: "Izmišljeni", submitted: false, ...NONE },
  { familyName: "Šimić", givenName: "Izmišljena", submitted: false, ...NONE },
  { familyName: null, givenName: null, submitted: false, ...NONE },
];
const READY = { id: P, state: "ready", downloadPath: `/api/v1/teacher/assignments/${A}/merlin/packages/${P}/download`, expiresAt: EXPIRES, sha256: ZIP };
const ERROR = (code: string, status: number) => ({ error: code, code, messageKey: "errors.x", status, requestId: "00000000-0000-4000-8000-000000000601" });

function apiAnswering(status: number, body: unknown) {
  const fetchImpl = vi.fn(async (_url: URL | RequestInfo, _init?: RequestInit) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
  return { api: createApi({ baseUrl: BASE_URL, fetchImpl }), fetchImpl };
}

describe("merlin paths", () => {
  it("reads the CSV and download paths from the contract", () => {
    expect(merlinCsvPath(A)).toBe(`/api/v1/teacher/assignments/${A}/merlin/csv`);
    expect(merlinDownloadPath(A, P)).toBe(READY.downloadPath);
  });
  it("encodes what it fills in", () => {
    expect(merlinCsvPath("a/b")).toBe("/api/v1/teacher/assignments/a%2Fb/merlin/csv");
  });
});

describe("readMerlinRoster", () => {
  it("keeps the server's order of the rows, a student without a name last (D-286)", async () => {
    const { api, fetchImpl } = apiAnswering(200, { rows: ROWS, extensionReasons: [] });
    const read = await readMerlinRoster(api, A);
    expect(read).toEqual({ kind: "ready", rows: ROWS, extensionReasons: [] });
    expect(String(fetchImpl.mock.calls[0]![0])).toBe(`${BASE_URL}/api/v1/teacher/assignments/${A}/merlin/roster`);
  });
  it("does not reorder a roster the server sent in another order", async () => {
    const reversed = [...ROWS].reverse();
    const { api } = apiAnswering(200, { rows: reversed, extensionReasons: [] });
    const read = await readMerlinRoster(api, A);
    expect(read.kind === "ready" ? read.rows.map((r) => r.familyName) : null).toEqual([null, "Šimić", "Čolić", "Anić"]);
  });
  it("says an ended session, an unknown assignment and anything else apart", async () => {
    expect(await readMerlinRoster(apiAnswering(401, ERROR("unauthorized", 401)).api, A)).toEqual({ kind: "session-expired" });
    expect(await readMerlinRoster(apiAnswering(404, ERROR("not_found", 404)).api, A)).toEqual({ kind: "greska", code: "not_found" });
    expect(await readMerlinRoster(apiAnswering(503, ERROR("unavailable", 503)).api, A)).toEqual({ kind: "nepoznato" });
    expect(await readMerlinRoster(apiAnswering(200, { rows: ROWS }).api, A)).toEqual({ kind: "nepoznato" });
  });
});

describe("requestMerlinPackage", () => {
  it("sends the request key in the closed body and reads the package", async () => {
    const { api, fetchImpl } = apiAnswering(202, { id: P, state: "queued" });
    expect(await requestMerlinPackage(api, A, KEY)).toEqual({ kind: "zatrazeno", id: P, state: "queued" });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(`${BASE_URL}/api/v1/teacher/assignments/${A}/merlin/packages`);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ requestKey: KEY });
  });
  it("never sends a key outside the contract", async () => {
    const { api, fetchImpl } = apiAnswering(202, { id: P, state: "ready" });
    expect(await requestMerlinPackage(api, A, "kratko")).toEqual({ kind: "greska", code: "invalid" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("leaves a 503 or a broken connection unknown, so the same key goes again", async () => {
    expect(await requestMerlinPackage(apiAnswering(503, ERROR("unavailable", 503)).api, A, KEY)).toEqual({ kind: "nepoznato" });
    const api = createApi({ baseUrl: BASE_URL, fetchImpl: vi.fn(async () => { throw new TypeError("offline"); }) });
    expect(await requestMerlinPackage(api, A, KEY)).toEqual({ kind: "nepoznato" });
    expect(await requestMerlinPackage(apiAnswering(401, ERROR("unauthorized", 401)).api, A, KEY)).toEqual({ kind: "session-expired" });
    expect(await requestMerlinPackage(apiAnswering(404, ERROR("not_found", 404)).api, A, KEY)).toEqual({ kind: "greska", code: "not_found" });
  });
});

describe("readMerlinPackage", () => {
  it("reads a ready package with its path, expiry and the exact fingerprint", async () => {
    expect(await readMerlinPackage(apiAnswering(200, READY).api, A, P)).toEqual({ kind: "paket", pkg: READY });
  });
  it("does not trust a ready package that names another package's download path", async () => {
    const other = "00000000-0000-4000-8000-0000000000b2";
    const body = { ...READY, downloadPath: `/api/v1/teacher/assignments/${A}/merlin/packages/${other}/download` };
    expect(await readMerlinPackage(apiAnswering(200, body).api, A, P)).toEqual({ kind: "nepoznato" });
    expect(await readMerlinPackage(apiAnswering(200, { ...READY, id: other }).api, A, P)).toEqual({ kind: "nepoznato" });
  });
  it("refuses a ready package without its fingerprint", async () => {
    const { sha256: _sha, ...partial } = READY;
    expect(await readMerlinPackage(apiAnswering(200, partial).api, A, P)).toEqual({ kind: "nepoznato" });
  });
});

describe("packageView", () => {
  const before = Date.parse(EXPIRES) - 60_000;
  it("is being prepared while queued and failed when the build failed", () => {
    expect(packageView({ id: P, state: "queued" }, before)).toEqual({ kind: "priprema" });
    expect(packageView({ id: P, state: "failed" }, before)).toEqual({ kind: "neuspjeh" });
  });
  it("offers the download only for a ready package before its expiry (C-16)", () => {
    expect(packageView(READY as never, before)).toEqual({ kind: "spreman", downloadPath: READY.downloadPath, expiresAt: EXPIRES, sha256: ZIP });
  });
  it("shows the link as expired at and after the expiry, and for an expired package", () => {
    expect(packageView(READY as never, Date.parse(EXPIRES))).toEqual({ kind: "istekao", expiresAt: EXPIRES, sha256: ZIP });
    expect(packageView({ id: P, state: "expired", expiresAt: EXPIRES, sha256: ZIP }, before)).toEqual({ kind: "istekao", expiresAt: EXPIRES, sha256: ZIP });
  });
});

describe("helpers", () => {
  it("makes a request key the contract accepts and refuses one it does not", () => {
    expect(newRequestKey()).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
    expect(() => newRequestKey(() => "nije valjan ključ")).toThrow();
  });
  it("knows whether any work was submitted", () => {
    expect(hasSubmissions(ROWS)).toBe(true);
    expect(hasSubmissions(ROWS.slice(1))).toBe(false);
  });
});
