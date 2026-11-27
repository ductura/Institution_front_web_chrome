// ED-76: recognising the source of a paste and citing it right after. Invented texts only.
import { getSchema } from "@tiptap/core";
import { EditorState } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";
import { createEditorExtensionsV2, tiptapToCanonicalV2 } from "@/editor";

import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import type { NotebookEntry } from "../source-notebook/notebook";
import { pasteSourceHr } from "./messages.hr";
import { citeAfterPaste, normal, recognizePaste } from "./paste-source";

const garden = { id: "00000000-0000-4000-8000-00000000c0a1", label: "Izmišljeni institut (2026)" };
const river = { id: "00000000-0000-4000-8000-00000000c0a2", label: "Izmišljena udruga (2025)" };
const note = (source: typeof garden, quote: string | null, page: string | null, id = "00000000-0000-4000-8000-00000000b001"): NotebookEntry =>
  ({ id, source, quote, page, note: null });
const QUOTE = "Kišni vrt zadržava vodu s krova i polako je vraća u tlo kroz slojeve pijeska.";
const PASTE = `Kao što piše u izvoru, ${QUOTE} To je važno za grad.`;

describe("recognizePaste", () => {
  it("finds the note whose quote the paste holds, with its page", () => {
    expect(recognizePaste([note(garden, QUOTE, " 12–14 ")], PASTE)).toEqual({ sourceId: garden.id, label: garden.label, page: "12–14" });
  });

  it("reads a quote broken into lines as in a PDF, and ignores case", () => {
    const pdf = "kišni vrt zadržava vo-\ndu s krova i polako je\nvraća u tlo kroz slojeve pijeska i šljunka.";
    expect(recognizePaste([note(garden, QUOTE, "12")], pdf)?.sourceId).toBe(garden.id);
    expect(normal("A  b\n\nC")).toBe("a b c");
  });

  it("leaves a short paste, a short quote and a note without a quote alone", () => {
    expect(recognizePaste([note(garden, QUOTE, "12")], "Kišni vrt zadržava vodu s krova.")).toBeNull();
    expect(recognizePaste([note(garden, "Kišni vrt zadržava.", "12")], PASTE)).toBeNull();
    expect(recognizePaste([note(garden, null, "12")], PASTE)).toBeNull();
    expect(recognizePaste([note(river, "Rijeka nosi mulj prema moru svake jeseni.", "3")], PASTE)).toBeNull();
  });

  it("takes the last matching note, and drops a page the citation cannot hold", () => {
    const entries = [note(river, QUOTE, "3"), note(garden, QUOTE, "14​", "00000000-0000-4000-8000-00000000b002")];
    expect(recognizePaste(entries, PASTE)).toEqual({ sourceId: garden.id, label: garden.label, page: "" });
  });
});

describe("citeAfterPaste", () => {
  const schema = getSchema(createEditorExtensionsV2());
  const doc = schema.nodeFromJSON({ type: "doc", attrs: { sources: [{
    id: garden.id, type: "book", title: "Izmišljeni vrt", year: 2026,
    authors: [{ kind: "organization", name: "Izmišljeni institut" }], place: "Izmišljeni grad", publisher: "Izmišljeni nakladnik",
  }] }, content: [{ type: "paragraph", attrs: { nodeId: "00000000-0000-4000-8000-000000000001" }, content: [{ type: "text", text: "Zalijepljen tekst." }] }] });
  const state = EditorState.create({ doc });
  const end = 1 + "Zalijepljen tekst.".length;

  it("puts the citation with the page right after the pasted text", () => {
    const tr = citeAfterPaste(state, end, { sourceId: garden.id, label: garden.label, page: "12" })!;
    const result = tiptapToCanonicalV2(tr.doc.toJSON());
    expect(result.ok && result.doc.nodes[0]?.children.map((c: { type: string }) => c.type)).toEqual(["text", "citation", "text"]);
    expect(result.ok && result.doc.nodes[0]?.children[1]).toEqual({ type: "citation", sourceId: garden.id, locator: "12" });
  });

  it("refuses a source the work does not have, or a place outside the text", () => {
    expect(citeAfterPaste(state, end, { sourceId: river.id, label: river.label, page: "3" })).toBeNull();
    expect(citeAfterPaste(state, 999, { sourceId: garden.id, label: garden.label, page: "12" })).toBeNull();
    expect(citeAfterPaste(state, 0, { sourceId: garden.id, label: garden.label, page: "12" })).toBeNull();
  });

  it("texts hold no forbidden term (Ductus PRODUCT §5)", () => {
    const all = [...Object.values(pasteSourceHr).filter((v) => typeof v === "string"), pasteSourceHr.source("Izmišljeni institut (2026)", "12")];
    for (const value of all) expect(findForbiddenTerms(value, "hr")).toEqual([]);
  });
});
