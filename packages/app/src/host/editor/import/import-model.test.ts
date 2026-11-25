import { describe, expect, it } from "vitest";

import { afterConfirm, afterNotebook, afterPreview, editorContent, notebookContent, START } from "./import-model";

// ED-20 (NF2-P19): invented text only.
const preview = {
  importId: "22222222-2222-4222-8222-222222222222", manifestSha256: "a".repeat(64), format: "docx" as const, fileName: "rad.docx",
  blocks: [{ type: "paragraph" as const, children: [{ type: "text" as const, text: "Izmišljeni odlomak.", marks: [] }] }],
  words: 2, expiresAt: "2026-11-25T12:00:00.000Z",
};

describe("import flow", () => {
  it("shows the preview first and maps refusals to the choose step with the prototype's text", () => {
    expect(afterPreview({ kind: "preview", preview })).toEqual({ step: "preview", preview });
    expect(afterPreview({ kind: "refused", reason: "type" })).toEqual({ step: "choose", error: "Podržani su samo .docx i .pdf." });
    expect(afterPreview({ kind: "refused", reason: "tooLarge" })).toEqual({ step: "choose", error: "Datoteka je veća od 2 MB. Odaberite manju ili zalijepite tekst." });
    expect(afterPreview({ kind: "notAllowed" })).toEqual({ step: "choose", error: "Uvoz za ovaj rad nije dopušten." });
  });
  it("finishes with the words, keeps the preview on a passing failure and starts over when expired or changed", () => {
    const busy = { step: "confirming" as const, preview };
    expect(afterConfirm(busy, { kind: "confirmed", eventId: "e-1" })).toEqual({ step: "done", words: 2 });
    expect(afterConfirm(busy, { kind: "unavailable" })).toMatchObject({ step: "preview", preview });
    expect(afterConfirm(busy, { kind: "expired" })).toEqual({ step: "choose", error: "Pregled je istekao. Odaberite datoteku ponovno." });
    expect(afterConfirm(busy, { kind: "changed" })).toEqual({ step: "choose", error: "Rad se u međuvremenu promijenio. Odaberite datoteku ponovno." });
    expect(afterConfirm(START, { kind: "confirmed", eventId: "e-1" })).toEqual(START);
  });
});

describe("editorContent", () => {
  it("keeps headings, marks and block kinds, drops server ids and empty text", () => {
    expect(editorContent([
      { type: "heading", level: 2, children: [{ type: "text", text: "Uvod", marks: [] }] },
      { type: "quote", children: [{ type: "text", text: "Navod", marks: ["italic"] }, { type: "text", text: "", marks: [] }] },
      { type: "bulletItem", children: [{ type: "text", text: "Stavka", marks: ["bold", "italic"] }] },
    ])).toEqual([
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Uvod" }] },
      { type: "quote", content: [{ type: "text", text: "Navod", marks: [{ type: "italic" }] }] },
      { type: "bulletItem", content: [{ type: "text", text: "Stavka", marks: [{ type: "bold" }, { type: "italic" }] }] },
    ]);
  });
});

describe("notebook import (7b)", () => {
  const book = (cells: unknown[]) => JSON.stringify({ metadata: { kernelspec: { language: "python" } }, cells });
  it("previews the blocks, counts what was dropped and refuses a bad file back to the choose step", () => {
    const state = afterNotebook("izmisljeno.ipynb", book([
      { cell_type: "markdown", source: "# Naslov" },
      { cell_type: "code", source: "print(1)", outputs: [{ output_type: "display_data", data: { "text/html": "<b>1</b>" } }] },
    ]));
    expect(state).toMatchObject({ step: "notebook", fileName: "izmisljeno.ipynb", discarded: 1 });
    expect(afterNotebook("a.ipynb", "{")).toEqual({ step: "choose", error: "Bilježnicu nije moguće pročitati. Provjerite je li ispravna." });
    expect(afterNotebook("a.ipynb", book([]))).toEqual({ step: "choose", error: "U bilježnici nema teksta ni kôda za uvoz." });
  });
  it("makes editor content where every text run carries the imported mark", () => {
    const state = afterNotebook("a.ipynb", book([{ cell_type: "markdown", source: "<script>x</script>" }, { cell_type: "code", source: "a = 1", outputs: [] }]));
    if (state.step !== "notebook") throw new Error("expected a preview");
    const imported = [{ type: "imported" }];
    expect(notebookContent(state.blocks)).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "<script>x</script>", marks: imported }] },
      { type: "codeBlock", attrs: { language: "python", caption: null }, content: [{ type: "text", text: "a = 1", marks: imported }] },
    ]);
  });
});
