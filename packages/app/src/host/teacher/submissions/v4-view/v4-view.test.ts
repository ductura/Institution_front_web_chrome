import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../../scripts/forbidden-terms/terms.ts";
import { FIXTURE_V4 } from "../../../../../../editor-core/src/document/document/fixture-v4.ts";
import { documentBlocks } from "../model";
import V4Blocks from "./V4Blocks";
import { v4ViewMessages } from "./messages.hr";

const json = (doc: unknown) => JSON.stringify(doc);
const html = (document: string) => {
  const view = documentBlocks(document);
  if (view.kind !== "v4") throw new Error(`not v4: ${view.kind}`);
  return renderToStaticMarkup(createElement(V4Blocks, { document: view.document }));
};

describe("teacher's read-only view of a v4 document", () => {
  it("shows every block of the fixture", () => {
    const out = html(json(FIXTURE_V4));
    expect(out).toContain("Kućno kompostiranje");
    expect(out).toContain('class="katex"'); // block and inline formula, KaTeX
    expect(out).toContain('data-line="2"'); // code with line numbers
    expect(out).toContain("def prosjek");
    expect(out).toContain("Prosjek");
    expect(out).toContain('data-box="theorem"');
    expect(out).toContain("Svaki konačan skup je ograničen.");
    expect(out).toContain("<table>");
    expect(out).toContain("Izmišljeni Grad");
    expect(out).toContain('data-image="true"');
    expect(out).toContain("Kompostište u dvorištu");
    expect(out).toContain("<hr");
  });

  it("numbers list items from the block order, with nesting", () => {
    const item = (n: number, level: number) => ({
      type: "numberedItem", id: `aaaaaaaa-aaaa-4aaa-8aaa-0000000001${n}0`, level, children: [{ type: "text", text: `Stavka ${n}`, marks: [] }],
    });
    const out = html(json({ ...FIXTURE_V4, nodes: [item(1, 1), item(2, 2), item(3, 1)] }));
    const plain = out.replace(/<[^>]+>/g, "");
    expect(plain).toMatch(/1\. ?Stavka 1/);
    expect(plain).toMatch(/1\.1\. ?Stavka 2/);
    expect(plain).toMatch(/2\. ?Stavka 3/);
  });

  it("leaves the MathML readable: no role or label on the formula wrapper", () => {
    const out = html(json(FIXTURE_V4));
    expect(out).toContain("<math");
    expect(out).not.toContain('role="math"');
  });

  it("does not run code, fetch the image or follow a link", () => {
    const out = html(json(FIXTURE_V4));
    expect(out).not.toMatch(/<img\b|<a\b|href=|<script/);
    expect(out).toContain(v4ViewMessages.codeRunNote);
  });

  it("shows an invalid formula as its source with a note, never throws", () => {
    const doc = { ...FIXTURE_V4, nodes: [{ type: "formula", id: FIXTURE_V4.nodes[2]!.id, tex: "\\frac{1" }] };
    const out = html(json(doc));
    expect(out).toContain("\\frac{1");
    expect(out).toContain(v4ViewMessages.formulaInvalid);
  });

  it("a v5 document, a damaged v4 one and bad JSON are unreadable, not empty", () => {
    expect(documentBlocks(json({ ...FIXTURE_V4, schemaVersion: 5 })).kind).toBe("unreadable");
    expect(documentBlocks(json({ ...FIXTURE_V4, nodes: [{ type: "codeBlock", id: "x", children: [] }] })).kind).toBe("unreadable");
    expect(documentBlocks(json({ ...FIXTURE_V4, nodes: [{ type: "script", id: "x" }] })).kind).toBe("unreadable");
    expect(documentBlocks(json({ ...FIXTURE_V4, nodes: "x" })).kind).toBe("unreadable");
    expect(documentBlocks("{").kind).toBe("unreadable");
    expect(documentBlocks("null").kind).toBe("unreadable");
  });

  it("keeps v1 and v2 reading as before", () => {
    const v1 = documentBlocks(json({ schemaVersion: 1, nodes: [{ type: "paragraph", children: [{ type: "text", text: "Tekst" }] }] }));
    expect(v1).toEqual({ kind: "ready", blocks: [{ kind: "paragraph", text: "Tekst" }] });
    expect(documentBlocks(json({ schemaVersion: 3, nodes: [] })).kind).toBe("unreadable");
  });

  it("copy has no forbidden terms", () => {
    expect(findForbiddenTerms(JSON.stringify(v4ViewMessages))).toEqual([]);
  });
});
