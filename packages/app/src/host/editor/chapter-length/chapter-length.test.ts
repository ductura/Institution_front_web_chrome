import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  DOCUMENT_SCHEMA_VERSION_V3,
  textNode,
  type CanonicalDocumentV3,
  type DocumentNodeV3,
  type NodeId,
} from "../../../../../editor-core/src/document/document/schema.ts";
import { canonicalToTiptap } from "../../../../../editor-core/src/editor/interop.ts";

import { readChapterTargets } from "./assignment-rules";
import { ChapterLength } from "./ChapterLength";
import { chapterWordCounts, editorChapterWordCounts } from "./chapter-length";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}` as NodeId;
const intro = { type: "heading", id: id(1), level: 1, children: [textNode("Izmišljeni uvod")] } as const;
const method = { type: "heading", id: id(3), level: 3, children: [textNode("Metoda")] } as const;
const paragraph = (n: number, text: string) => ({ type: "paragraph" as const, id: id(n), children: [textNode(text)] });
const documentOf = (...nodes: DocumentNodeV3[]): CanonicalDocumentV3 => ({ schemaVersion: DOCUMENT_SCHEMA_VERSION_V3, sources: [], nodes });
const render = (props: Parameters<typeof ChapterLength>[0]) => renderToStaticMarkup(createElement(ChapterLength, props));

describe("chapter length", () => {
  it("counts each heading's own blocks, excluding the preamble, headings and footnotes", () => {
    const doc = documentOf(paragraph(5, "Ovaj tekst je predgovor."), { ...intro, children: [...intro.children] }, {
      type: "paragraph", id: id(2), children: [textNode("Prva"), { type: "footnote", text: "Izmišljena fusnota ima pet riječi" }, textNode("riječ")],
    }, { ...method, children: [...method.children] });
    expect([...chapterWordCounts(doc)]).toEqual([[id(1), 2], [id(3), 0]]);
    expect([...chapterWordCounts(documentOf(paragraph(5, "Samo predgovor")))]).toEqual([]);
  });

  it("keeps counts attached to heading ids after a move and follows body edits", () => {
    const h1 = { ...intro, children: [...intro.children] };
    const h2 = { ...method, level: 1 as const, children: [...method.children] };
    const before = canonicalToTiptap({ schemaVersion: 1, nodes: [h1, paragraph(2, "Prvi tekst"), h2, paragraph(4, "Drugi")] });
    const after = canonicalToTiptap({ schemaVersion: 1, nodes: [h2, paragraph(4, "Drugi novi tekst"), h1, paragraph(2, "Prvi tekst")] });
    const original = { toJSON: () => before };
    expect(editorChapterWordCounts(original)).toEqual([2, 1]);
    expect(editorChapterWordCounts(original)).toBe(editorChapterWordCounts(original));
    expect(editorChapterWordCounts({ toJSON: () => after })).toEqual([3, 2]);
    expect(editorChapterWordCounts({ toJSON: () => ({ type: "doc", content: [
      { type: "heading", attrs: { level: 1 } },
      { type: "paragraph", content: [{ type: "text", text: "Novi tekst" }] },
    ] }) })).toEqual([2]);
  });

  it("shows only the count when no chapter range is supplied and treats counts outside a range the same", async () => {
    const ranges = await readChapterTargets("izmisljeni-zadatak", async (assignmentId) => {
      expect(assignmentId).toBe("izmisljeni-zadatak");
      return { ok: true, body: { wordRange: { min: 100, max: 200 }, chapterWordRanges: {
        [id(1)]: { min: 10, max: 20 },
        [id(2)]: { min: 20, max: 10 },
        [id(3)]: { min: null, max: 10 },
        [id(4)]: { min: 5, max: null },
      } } };
    });
    expect(render({ words: 1, target: ranges.get(id(2)) })).toMatch(/>1 riječ<\/span>$/);
    expect(render({ words: 2, target: ranges.get(id(1)) })).toContain("2 riječi · cilj 10–20 riječi");
    expect(render({ words: 22, target: ranges.get(id(1)) })).toContain("22 riječi · cilj 10–20 riječi");
    expect(render({ words: 1, target: ranges.get(id(3)) })).toContain("cilj do 10 riječi");
    expect(render({ words: 1, target: ranges.get(id(4)) })).toContain("cilj od 5 riječi");
    expect(render({ words: 2, target: ranges.get(id(1)) })).not.toMatch(/alert|invalid|warning|error|disabled/i);
    expect((await readChapterTargets("izmisljeni-zadatak", async () => ({ ok: true, body: { wordRange: { min: 100, max: 200 } } }))).size).toBe(0);
    expect((await readChapterTargets("izmisljeni-zadatak", async () => { throw new Error("offline"); })).size).toBe(0);
  });
});
