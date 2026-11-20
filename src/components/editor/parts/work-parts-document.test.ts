import { Schema, type Node } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";
import { afterEach, expect, it, vi } from "vitest";

import { workPartsMessages as t } from "./messages.hr";
import { readWorkParts, readWorkPartsDisplay, writeWorkParts, writeWorkPartsDisplay } from "./work-parts-document";
import type { WorkParts } from "./WorkPartsDialog";

const display = { abbreviations: false, romanNumerals: false, endnotes: false, index: false };
const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    heading: { group: "block", content: "text*", attrs: { level: { default: 2 } } },
    paragraph: { group: "block", content: "text*" },
    text: {},
  },
});
const heading = (title: string, level = 2) => schema.node("heading", { level }, schema.text(title));
const paragraph = (text: string) => schema.node("paragraph", null, schema.text(text));
const document = (...nodes: Node[]) => schema.node("doc", null, nodes);
const sections: WorkParts = {
  ...display,
  declaration: { enabled: true, text: "" },
  acknowledgments: { enabled: true, text: "Prva izmišljena rečenica.\nDruga izmišljena rečenica." },
  biography: { enabled: true, text: "Izmišljeni životopis." },
};

afterEach(() => vi.unstubAllGlobals());

it("places front and back sections around existing content as ordinary document nodes", () => {
  const title = heading("Izmišljeni rad", 1);
  const chapter = heading("Pokus");
  const body = paragraph("Izmišljeni opis pokusa.");
  const tr = EditorState.create({ doc: document(title, chapter, body) }).tr;

  expect(writeWorkParts(tr, sections)).toBe(true);
  expect(tr.doc.eq(document(
    title, heading(t.declaration), paragraph(t.declarationTemplate),
    heading(t.acknowledgments), paragraph("Prva izmišljena rečenica."), paragraph("Druga izmišljena rečenica."),
    chapter, body, heading(t.biography), paragraph("Izmišljeni životopis."),
  ))).toBe(true);
  expect(readWorkParts(tr.doc, display)?.acknowledgments).toEqual(sections.acknowledgments);
});

it("maps edits to several existing sections without touching the following chapter", () => {
  const chapter = heading("Izmišljeni uvod");
  const body = paragraph("Izmišljena građa.");
  const tr = EditorState.create({ doc: document(
    heading(t.declaration), paragraph(t.declarationTemplate),
    heading(t.acknowledgments), paragraph("Stara zahvala."),
    chapter, body,
  ) }).tr;

  expect(writeWorkParts(tr, {
    ...sections, declaration: { enabled: false, text: "" }, biography: { enabled: false, text: "" },
  })).toBe(true);
  expect(tr.doc.eq(document(
    heading(t.acknowledgments), paragraph("Prva izmišljena rečenica."), paragraph("Druga izmišljena rečenica."), chapter, body,
  ))).toBe(true);
});

it("protects an ambiguous document with duplicate section headings", () => {
  const doc = document(heading(t.biography), paragraph("Prvi primjer."), heading(t.biography), paragraph("Drugi primjer."));
  const tr = EditorState.create({ doc }).tr;
  expect(readWorkParts(doc, display)).toBeNull();
  expect(writeWorkParts(tr, sections)).toBe(false);
  expect(tr.doc.eq(doc)).toBe(true);
});

it("stores only the four display switches and isolates them per work", () => {
  const stored = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => stored.get(key), setItem: stored.set.bind(stored) });
  const next = { ...sections, romanNumerals: true };
  expect(writeWorkPartsDisplay("demo-work", display, next)).toBe(true);
  expect(readWorkPartsDisplay("demo-work")).toEqual({ ...display, romanNumerals: true });
  expect(readWorkPartsDisplay("other-demo-work")).toEqual(display);
  expect(JSON.parse(stored.get("demo-work")!)).toEqual({ ...display, romanNumerals: true });
});
