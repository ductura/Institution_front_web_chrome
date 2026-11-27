// ED-104 (prototype text2.js holePop): a hole that asks for a source offers the work's sources, and choosing one
// turns it into a citation. Invented text and invented sources.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Schema } from "@tiptap/pm/model";

import { holeNeedsSource, sourcesOf } from "./hole-source";
import { MarkActions } from "./MarksHost";
import { allPlaces, type Place } from "./marks-model";

const S1 = "11111111-1111-4111-8111-111111111111";
const S2 = "22222222-2222-4222-8222-222222222222";
const schema = new Schema({
  nodes: {
    doc: { content: "paragraph+", attrs: { sources: { default: [] } } },
    paragraph: { content: "inline*", group: "block" },
    text: { group: "inline" },
  },
});
const doc = schema.node("doc", { sources: [
  { id: S1, type: "book", title: "Izmišljena knjiga o vrtovima", authors: [{ family: "Izmišljenić", given: "Ana" }], issued: { year: 2020 } },
  { id: S2, type: "book", title: "Druga izmišljena knjiga", authors: [{ family: "Primjerić", given: "Ivo" }], issued: { year: 2018 } },
] }, [schema.node("paragraph", null, [schema.text("Tvrdnja [izvor] pa [?] i [citat Ivić].")])]);
const holes = allPlaces(doc, []).filter((p) => p.kind === "hole");

describe("a hole that asks for a source", () => {
  it("tells [izvor] and [citat …] from a mark to check", () => {
    expect(holes.map((h) => holeNeedsSource(doc, h))).toEqual([true, false, true]);
  });

  it("lists the work's sources", () => {
    expect(sourcesOf(doc).map((s) => s.id)).toEqual([S1, S2]);
  });

  const noop = () => {};
  const render = (place: Place, editable: boolean, sources?: { id: string; label: string }[]) =>
    renderToStaticMarkup(createElement(MarkActions, { place, more: true, editable, onNext: noop, onRemove: noop,
      onLink: noop, sources, onSource: noop, onAskSource: noop }));

  it("offers the sources, Dodaj novi izvor and the next place, but no removal", () => {
    const out = render(holes[0]!, true, [{ id: S1, label: "Izmišljenić, 2020" }]);
    expect(out).toContain("Ovdje nedostaje izvor");
    expect(out).toContain("Svi izvori (1)");
    expect(out).toContain("Izmišljenić, 2020");
    expect(out).toContain("Dodaj novi izvor…");
    expect(out).toContain("Sljedeće mjesto ›");
    expect(out).not.toContain("Provjereno, ukloni");
  });

  it("only explains on a text that cannot be written", () => {
    const out = render(holes[0]!, false, [{ id: S1, label: "Izmišljenić, 2020" }]);
    expect(out).not.toContain("Ovdje nedostaje izvor");
    expect(out).not.toContain("<button type=\"button\">Izmišljenić");
  });

  it("offers Zapravo treba izvor on a mark to check", () => {
    const out = render(holes[1]!, true);
    expect(out).toContain("Provjereno, ukloni");
    expect(out).toContain("Zapravo treba izvor");
  });
});
