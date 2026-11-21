import { describe, expect, it } from "vitest";

import { confirmImport, importFormatOf, previewImport, readImportPermission, unavailableTransport, type ImportRaw, type ImportTransport } from "./import";

// WEB-1801: probe answers of the import contract (not generated yet). Invented ids and text.
const A = "11111111-1111-4111-8111-111111111111";
const P = "22222222-2222-4222-8222-222222222222";
const file = (name: string, size = 10) => new File([new Uint8Array(size)], name);
const only = (raw: ImportRaw): ImportTransport => ({ permission: async () => raw, preview: async () => raw, confirm: async () => raw });

describe("readImportPermission", () => {
  it("allows only an explicit true", async () => {
    expect(await readImportPermission(A, only({ ok: true, status: 200, body: { importAllowed: true } }))).toEqual({ kind: "allowed" });
    expect(await readImportPermission(A, only({ ok: true, status: 200, body: { importAllowed: false } }))).toEqual({ kind: "notAllowed" });
  });
  it("is unavailable for anything else, and never allowed by default", async () => {
    expect(await readImportPermission(A)).toEqual({ kind: "unavailable" });
    expect(await readImportPermission(A, only({ ok: true, status: 200, body: { importAllowed: "yes" } }))).toEqual({ kind: "unavailable" });
    expect(await readImportPermission("x", unavailableTransport)).toEqual({ kind: "notAllowed" });
    expect(await readImportPermission(A, only({ ok: false, status: 401 }))).toEqual({ kind: "signedOut" });
  });
});

describe("previewImport", () => {
  const good = { previewId: P, format: "docx", words: 4, paragraphs: ["Izmišljeni odlomak jedan.", "Drugi odlomak."] };
  it("accepts a DOCX preview and keeps the paragraphs as text", async () => {
    const r = await previewImport(A, file("rad.docx"), only({ ok: true, status: 200, body: good }));
    expect(r).toEqual({ kind: "preview", preview: { previewId: P, format: "docx", paragraphs: good.paragraphs, words: 4 } });
  });
  it("refuses a wrong type, an empty or a too large file before any call", async () => {
    let calls = 0;
    const t: ImportTransport = { ...unavailableTransport, preview: async () => { calls += 1; return { ok: true, status: 200, body: good }; } };
    expect(await previewImport(A, file("rad.txt"), t)).toEqual({ kind: "refused", reason: "type" });
    expect(await previewImport(A, file("rad.docx", 0), t)).toEqual({ kind: "refused", reason: "empty" });
    expect(await previewImport(A, file("rad.pdf", 10 * 1024 * 1024 + 1), t)).toEqual({ kind: "refused", reason: "tooLarge" });
    expect(calls).toBe(0);
  });
  it("maps server answers and rejects a shape it does not know", async () => {
    expect(await previewImport(A, file("a.pdf"), only({ ok: false, status: 403 }))).toEqual({ kind: "notAllowed" });
    expect(await previewImport(A, file("a.pdf"), only({ ok: false, status: 422 }))).toEqual({ kind: "refused", reason: "unreadable" });
    expect(await previewImport(A, file("a.pdf"), only({ ok: true, status: 200, body: { ...good, format: "docx" } }))).toEqual({ kind: "unavailable" });
    expect(await previewImport(A, file("a.docx"), only({ ok: true, status: 200, body: { ...good, extra: 1, paragraphs: [1] } }))).toEqual({ kind: "unavailable" });
    expect(await previewImport(A, file("a.docx"), only({ ok: true, status: 200, body: { ...good, paragraphs: [] } }))).toEqual({ kind: "refused", reason: "empty" });
  });
  it("names the format by extension only", () => {
    expect(importFormatOf({ name: "A.DOCX" })).toBe("docx");
    expect(importFormatOf({ name: "a.doc" })).toBeNull();
  });
});

describe("confirmImport", () => {
  const ok = { source: "file_import", words: 4, importedAt: "2026-11-21T10:00:00.000Z" };
  it("needs the declaration and returns the event marked as import", async () => {
    expect(await confirmImport(A, P, false, only({ ok: true, status: 200, body: ok }))).toEqual({ kind: "unavailable" });
    expect(await confirmImport(A, P, true, only({ ok: true, status: 200, body: ok }))).toEqual({ kind: "confirmed", confirmed: ok });
  });
  it("maps expired, forbidden and broken answers", async () => {
    expect(await confirmImport(A, P, true, only({ ok: false, status: 410 }))).toEqual({ kind: "expired" });
    expect(await confirmImport(A, P, true, only({ ok: false, status: 403 }))).toEqual({ kind: "notAllowed" });
    expect(await confirmImport(A, P, true, only({ ok: true, status: 200, body: { ...ok, source: "typed" } }))).toEqual({ kind: "unavailable" });
  });
});
