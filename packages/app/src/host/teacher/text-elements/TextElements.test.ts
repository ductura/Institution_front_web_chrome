import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TextElementsView } from "./TextElements";
import { buildElements } from "./model";

const SRC = { id: "11111111-1111-4111-8111-111111111111", type: "book", authors: [{ kind: "person", family: "Autor A", given: "Ana" }], year: 2019, title: "Izmišljena knjiga", place: "Grad", publisher: "Nakladnik" };
const doc = { schemaVersion: 3, sources: [SRC], nodes: [{ type: "paragraph", id: "22222222-2222-4222-8222-222222222222",
  children: [{ type: "text", text: "Tvrdnja", marks: [] }, { type: "citation", sourceId: SRC.id, locator: "14" }, { type: "footnote", text: "Bilješka." }] }] } as never;

describe("TextElementsView", () => {
  it("marks citation and note as atoms so comment offsets ignore their labels", () => {
    const html = renderToStaticMarkup(h(TextElementsView, { elements: buildElements(doc) }));
    expect(html).toContain('data-atom="citation"');
    expect(html).toContain('data-atom="footnote"');
    expect(html).toContain("(Autor A, 2019: 14)");
    expect(html).toContain('data-node-id="22222222-2222-4222-8222-222222222222"');
  });
});

describe("cross reference rendering", () => {
  it("draws the referenced heading as an atom", () => {
    const H = "44444444-4444-4444-8444-444444444444";
    const d = { schemaVersion: 3, sources: [], nodes: [
      { type: "heading", id: H, level: 1, children: [{ type: "text", text: "Uvod", marks: [] }] },
      { type: "paragraph", id: "22222222-2222-4222-8222-222222222222", children: [{ type: "crossReference", targetId: H }] }] } as never;
    const html = renderToStaticMarkup(h(TextElementsView, { elements: buildElements(d) }));
    expect(html).toContain('data-atom="crossReference"');
    expect(html).toContain("[upućivanje: Uvod]");
  });
});
