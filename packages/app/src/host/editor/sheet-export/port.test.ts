import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { CSV_MIME, exportFileName, exportPath, readExport, XLSX_MIME } from "./port";

// Invented ids and bytes only.
const DOC = "doc-sheet-1";
const origin = "http://localhost";
(globalThis as { location?: unknown }).location ??= { origin };

type Route = { path: string; method: string; query?: { properties?: Record<string, unknown> } };
const routes = JSON.parse(readFileSync(new URL("../../../../../../src/client/migration-contracts.generated.json", import.meta.url), "utf8")) as Record<string, Route>;

const hex = async (bytes: Uint8Array<ArrayBuffer>) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (b) => b.toString(16).padStart(2, "0")).join("");
const zip = new Uint8Array([0x50, 0x4b, 3, 4, 1, 2, 3]);
const csv = new TextEncoder().encode("﻿A;B\r\n1;2\r\n");
const answer = (status: number, type: string | null, bytes: Uint8Array | null, extra: Record<string, string> = {}) =>
  (async () => new Response(bytes === null ? null : (bytes as BodyInit), { status, headers: { ...(type === null ? {} : { "content-type": type }), ...extra } })) as unknown as typeof fetch;

describe("exportPath (WEB-V14-SHEET-EXPORT)", () => {
  it("is the path the contract names for each operation", () => {
    expect(routes["work.export-sheet-csv.get"]!.path).toBe(exportPath("csv", "{documentId}").replace("%7BdocumentId%7D", "{documentId}"));
    expect(routes["work.export-sheet-xlsx.get"]!.path).toBe(exportPath("xlsx", "{documentId}").replace("%7BdocumentId%7D", "{documentId}"));
    expect(routes["work.export-sheet-csv.get"]!.method).toBe("GET");
  });
  it("encodes the document id", () => { expect(exportPath("csv", "a/b c")).toBe("/api/v1/works/a%2Fb%20c/export/csv"); });
});

describe("readExport", () => {
  it("asks one GET without sheet or version, so the server gives the first sheet and the saved version", async () => {
    const seen: [string, RequestInit | undefined][] = [];
    const transport = (async (url: URL, init?: RequestInit) => { seen.push([String(url), init]); return new Response(csv as BodyInit, { status: 200, headers: { "content-type": `${CSV_MIME}; charset=utf-8` } }); }) as unknown as typeof fetch;
    const r = await readExport(transport, "csv", DOC);
    expect(r.kind).toBe("ready");
    expect(seen).toHaveLength(1);
    expect(seen[0]![0]).toBe(`${origin}/api/v1/works/${DOC}/export/csv`);
    expect(seen[0]![1]).toMatchObject({ method: "GET", credentials: "same-origin", redirect: "error" });
  });
  it("gives the CSV bytes unchanged", async () => {
    const r = await readExport(answer(200, CSV_MIME, csv), "csv", DOC);
    expect(r.kind === "ready" && Array.from(r.bytes)).toEqual(Array.from(csv));
  });
  it("accepts .xlsx whose digest is the one the server named", async () => {
    const r = await readExport(answer(200, XLSX_MIME, zip, { "x-export-sheet-sha256": await hex(zip as Uint8Array<ArrayBuffer>) }), "xlsx", DOC);
    expect(r.kind).toBe("ready");
  });
  it("refuses .xlsx whose digest is not the named one, and a named digest that is no digest", async () => {
    expect((await readExport(answer(200, XLSX_MIME, zip, { "x-export-sheet-sha256": "a".repeat(64) }), "xlsx", DOC)).kind).toBe("mismatch");
    expect((await readExport(answer(200, XLSX_MIME, zip, { "x-export-sheet-sha256": "zz" }), "xlsx", DOC)).kind).toBe("mismatch");
  });
  it("never calls an empty answer, a wrong media type or a non-ZIP .xlsx a file", async () => {
    expect((await readExport(answer(200, CSV_MIME, new Uint8Array()), "csv", DOC)).kind).toBe("not-a-file");
    expect((await readExport(answer(200, "application/json", csv), "csv", DOC)).kind).toBe("not-a-file");
    expect((await readExport(answer(200, null, csv), "csv", DOC)).kind).toBe("not-a-file");
    expect((await readExport(answer(200, XLSX_MIME, csv), "xlsx", DOC)).kind).toBe("not-a-file");
    expect((await readExport(answer(200, CSV_MIME, zip), "xlsx", DOC)).kind).toBe("not-a-file");
  });
  it("maps the contract's errors: 401 sign-in, 404 not found (another person's work too), 422 invalid, 503 and others unavailable", async () => {
    const kinds = await Promise.all([401, 404, 422, 503, 500, 403, 204, 302].map(async (s) => (await readExport(answer(s, null, null), "csv", DOC)).kind));
    expect(kinds).toEqual(["signed-out", "not-found", "invalid", "unavailable", "unavailable", "unavailable", "unavailable", "unavailable"]);
  });
  it("is unavailable, not a file, when the request throws or the body breaks", async () => {
    expect((await readExport((async () => { throw new TypeError("net"); }) as unknown as typeof fetch, "csv", DOC)).kind).toBe("unavailable");
    const broken = (async () => ({ status: 200, headers: new Headers({ "content-type": CSV_MIME }), arrayBuffer: async () => { throw new Error("cut"); } })) as unknown as typeof fetch;
    expect((await readExport(broken, "csv", DOC)).kind).toBe("unavailable");
  });
});

describe("exportFileName", () => {
  it("replaces what a file name cannot hold and falls back to a name", () => {
    expect(exportFileName('Proračun: 1/2?', "csv")).toBe("Proračun_ 1_2_.csv");
    expect(exportFileName("  ", "xlsx")).toBe("tablica.xlsx");
    expect(exportFileName(null, "csv")).toBe("tablica.csv");
  });
});

describe("mounting", () => {
  it("SheetExport is mounted in the ready phase of SheetPage with the work's document id", () => {
    const page = readFileSync(new URL("../sheet/SheetPage.tsx", import.meta.url), "utf8");
    expect(page).toContain('import SheetExport from "../sheet-export/SheetExport";');
    expect(page).toMatch(/<SheetExport documentId=\{session\.documentId\}/);
  });
});
