import { describe, expect, it } from "vitest";

import { confirmImport, countWords, fileBase64, importFormatOf, previewImport, type ImportPreview, type ImportText } from "./import";

// ED-20 (NF2-P19): the import client over the generated contract, with a fake api. Invented ids and text.
const D = "33333333-3333-4333-8333-333333333333";
const I = "22222222-2222-4222-8222-222222222222";
const SHA = "a".repeat(64);
const file = (name: string, size = 10) => new File([new Uint8Array(size)], name);
type Call = { id: string; input: { params: unknown; body: unknown } };
function fake(answer: unknown) {
  const calls: Call[] = [];
  const api = async (id: string, input: Call["input"]) => { calls.push({ id, input }); return answer; };
  return { calls, api: api as unknown as Parameters<typeof previewImport>[2] };
}
const text = (t: string, marks: ImportText["marks"] = []): ImportText => ({ type: "text", text: t, marks });
const PREVIEW_BODY = {
  importId: I, manifestSha256: SHA, source: "import", evidenceKind: "imported", fileFormat: "docx",
  content: { schemaVersion: 2, sources: [], nodes: [
    { type: "heading", id: "h1", level: 2, children: [text("Izmišljeni uvod")] },
    { type: "paragraph", id: "p1", children: [text("Prvi "), text("odlomak", ["bold"]), text(" teksta.")] },
    { type: "paragraph", id: "p2", children: [text("  ")] },
  ] },
  traces: [], rawByteLength: 10, fileName: "rad.docx", baseRevision: 3, expiresAt: "2026-11-25T12:00:00.000Z",
};

describe("previewImport", () => {
  it("sends the file as base64 and keeps the blocks with their marks, without empty ones", async () => {
    const { api, calls } = fake({ ok: true, status: 201, body: PREVIEW_BODY });
    const r = await previewImport(D, file("rad.docx", 3), api);
    expect(calls).toEqual([{ id: "work.imports.post", input: { params: { documentId: D }, query: undefined, body: { fileBase64: "AAAA", fileName: "rad.docx" } } }]);
    expect(r).toEqual({ kind: "preview", preview: {
      importId: I, manifestSha256: SHA, format: "docx", fileName: "rad.docx", words: 5, expiresAt: PREVIEW_BODY.expiresAt,
      blocks: [
        { type: "heading", level: 2, children: [text("Izmišljeni uvod")] },
        { type: "paragraph", children: [text("Prvi "), text("odlomak", ["bold"]), text(" teksta.")] },
      ],
    } });
  });
  it("refuses a wrong type, an empty or a file over 2 MB before any call", async () => {
    const { api, calls } = fake({ ok: true, status: 201, body: PREVIEW_BODY });
    expect(await previewImport(D, file("rad.txt"), api)).toEqual({ kind: "refused", reason: "type" });
    expect(await previewImport(D, file("rad.docx", 0), api)).toEqual({ kind: "refused", reason: "empty" });
    expect(await previewImport(D, file("rad.pdf", 2 * 1024 * 1024 + 1), api)).toEqual({ kind: "refused", reason: "tooLarge" });
    expect(calls).toHaveLength(0);
  });
  it("maps the server's codes", async () => {
    const answer = async (status: number, code: string) => previewImport(D, file("a.pdf"), fake({ ok: false, status, code }).api);
    expect(await answer(401, "unauthorized")).toEqual({ kind: "signedOut" });
    expect(await answer(403, "import_not_allowed")).toEqual({ kind: "notAllowed" });
    expect(await answer(413, "body_too_large")).toEqual({ kind: "refused", reason: "tooLarge" });
    expect(await answer(415, "unsupported_media_type")).toEqual({ kind: "refused", reason: "type" });
    expect(await answer(422, "pdf_no_text_layer")).toEqual({ kind: "refused", reason: "noTextLayer" });
    expect(await answer(422, "invalid_document")).toEqual({ kind: "refused", reason: "unreadable" });
    expect(await answer(503, "unavailable")).toEqual({ kind: "unavailable" });
  });
  it("is unavailable when the format differs, empty when no text is left, unavailable when the call throws", async () => {
    expect(await previewImport(D, file("a.pdf"), fake({ ok: true, status: 201, body: PREVIEW_BODY }).api)).toEqual({ kind: "unavailable" });
    const blank = { ...PREVIEW_BODY, content: { ...PREVIEW_BODY.content, nodes: [PREVIEW_BODY.content.nodes[2]] } };
    expect(await previewImport(D, file("a.docx"), fake({ ok: true, status: 201, body: blank }).api)).toEqual({ kind: "refused", reason: "empty" });
    const broken = (async () => { throw new Error("mreža"); }) as unknown as Parameters<typeof previewImport>[2];
    expect(await previewImport(D, file("a.docx"), broken)).toEqual({ kind: "unavailable" });
  });
  it("names the format by extension only and counts words", () => {
    expect(importFormatOf({ name: "A.DOCX" })).toBe("docx");
    expect(importFormatOf({ name: "a.doc" })).toBeNull();
    expect(countWords([{ type: "paragraph", children: [text("Dvije riječi")] }])).toBe(2);
  });
  it("encodes a large file without overflowing", async () => {
    const big = await fileBase64(new Blob([new Uint8Array(200_000)]));
    expect(big.length).toBe(Math.ceil(200_000 / 3) * 4);
  });
});

describe("confirmImport", () => {
  const preview: ImportPreview = { importId: I, manifestSha256: SHA, format: "docx", fileName: "rad.docx", blocks: [], words: 0, expiresAt: PREVIEW_BODY.expiresAt };
  it("sends the preview's manifest and returns the event", async () => {
    const { api, calls } = fake({ ok: true, status: 200, body: { importId: I, eventId: "e-1" } });
    expect(await confirmImport(D, preview, api)).toEqual({ kind: "confirmed", eventId: "e-1" });
    expect(calls[0]).toEqual({ id: "work.imports.confirm.post", input: { params: { documentId: D, importId: I }, query: undefined, body: { importId: I, manifestSha256: SHA } } });
  });
  it("maps expired, changed, forbidden and a foreign event", async () => {
    const answer = async (status: number, code: string) => confirmImport(D, preview, fake({ ok: false, status, code }).api);
    expect(await answer(410, "import_expired")).toEqual({ kind: "expired" });
    expect(await answer(404, "import_not_found")).toEqual({ kind: "expired" });
    expect(await answer(409, "import_revision_changed")).toEqual({ kind: "changed" });
    expect(await answer(403, "import_not_allowed")).toEqual({ kind: "notAllowed" });
    expect(await answer(401, "unauthorized")).toEqual({ kind: "signedOut" });
    expect(await answer(409, "import_manifest_mismatch")).toEqual({ kind: "unavailable" });
    expect(await confirmImport(D, preview, fake({ ok: true, status: 200, body: { importId: "x", eventId: "e" } }).api)).toEqual({ kind: "unavailable" });
  });
});
