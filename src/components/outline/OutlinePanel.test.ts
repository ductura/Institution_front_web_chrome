import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { messagesHr as t } from "../../../locales/hr.ts";

import OutlinePanel from "./OutlinePanel";
import type { OutlineRow } from "./outline-tree";

// Invented headings only; never the text of a real work.
let pos = 0;
const row = (level: number, text: string, number: string | null = null, id: string | null = `n${pos}`): OutlineRow =>
  ({ entry: { id, level, text, pos: (pos += 10) }, number });
const render = (rows: readonly OutlineRow[]) => renderToStaticMarkup(createElement(OutlinePanel, { rows }));
const count = (html: string, s: string) => html.split(s).length - 1;

describe("OutlinePanel: negative inputs first (DAN-977, 977-2)", () => {
  it("an empty list keeps the labelled nav with the empty text and no list", () => {
    const html = render([]);
    expect(html).toContain(`<nav aria-label="${t.outline.label}"`);
    expect(html).toContain(t.workspace.structureEmpty);
    expect(html).not.toContain("<ol");
  });

  it("does not show a level outside 1 to 3", () => {
    const html = render([row(0, "Nula"), row(4, "Četiri"), row(1.5, "Pola"), row(1, "Uvod", "1")]);
    expect(html).not.toMatch(/Nula|Četiri|Pola/);
    expect(count(html, "<li")).toBe(1);
  });

  it("shows the untitled text for an empty or blank title", () => {
    const html = render([row(1, ""), row(1, "   ")]);
    expect(count(html, t.outline.untitledHeading)).toBe(2);
  });

  it("shows no number element when the number is null or empty", () => {
    const html = render([row(1, "Uvod", null), row(1, "Okvir", "")]);
    expect(html).not.toContain('data-number');
    expect(html).toContain("Uvod");
    expect(html).toContain("Okvir");
  });

  it("shows HTML in a title as text", () => {
    const html = render([row(1, "<b>Izmišljeno</b>", "1")]);
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;b&gt;Izmišljeno&lt;/b&gt;");
  });

  it("shows every row once with duplicate and __proto__ ids, in order, and sets no id attribute", () => {
    const ids = ["__proto__", "isti", "isti", null, "toString"];
    const html = render(ids.map((id, i) => row(1, `Izmišljeno ${i}`, String(i + 1), id)));
    expect(count(html, "<li")).toBe(5);
    expect([...html.matchAll(/data-node-id="([^"]*)"/g)].map((m) => m[1])).toEqual(["__proto__", "isti", "isti", "toString"]);
    expect(html).not.toMatch(/\sid="/);
  });

  it("keeps a 2000-character title whole", () => {
    const long = "izmišljeno".repeat(200);
    expect(render([row(1, long, "1")])).toContain(long);
  });
});

describe("OutlinePanel: three levels with the numbering from the input (977-2 acceptance)", () => {
  it("nests lists at depth 1, 2 and 3 and shows each number once, as given", () => {
    const html = render([
      row(1, "Uvod", "1"), row(2, "Pojmovi", "1.1"), row(3, "Izmišljeni pojam", "1.1.1"),
      row(1, "Metoda", "2"), row(2, "Uzorak", "2.1"), row(3, "Odabir", "2.1.3"),
    ]);
    expect([...html.matchAll(/<ol[^>]*data-depth="(\d)"/g)].map((m) => m[1])).toEqual(["1", "2", "3", "2", "3"]);
    for (const n of ["1", "1.1", "1.1.1", "2", "2.1", "2.1.3"]) expect(count(html, `>${n}</span>`)).toBe(1);
    expect(html).toMatch(/2\.1\.3<\/span>[^<]*<span[^>]*>Odabir</);
    // A nested list always sits inside a list item (axe list/listitem).
    expect(html).not.toMatch(/(?:<ol[^>]*>|<\/li>)<ol/);
  });
});
