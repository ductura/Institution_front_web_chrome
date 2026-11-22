import { describe, expect, it } from "vitest";

import type { CanonicalDocumentV4, NodeId } from "../../../../../editor-core/src/document/document/index.ts";
import { parseCitationStyle } from "../../../../../editor-core/src/document/citation/style";
import fpzg from "../../../../../../config/faculties/fpzg/citation.json";

import { buildTex, texEscape } from "./latex";
import { stemHr } from "./messages.hr";
import { checkQuote, findQuotes, locatorPage } from "./quote-check";
import { dismissKey, reviewQuotes } from "./quote-review";

// WEB-2134 (par-e-stem): invented work, invented source, invented proof text.
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}` as NodeId;
const t = (text: string) => ({ type: "text" as const, text, marks: [] });
const QUOTE = "Svaka pojava ima svoj uzrok u prethodnoj pojavi";
const doc: CanonicalDocumentV4 = {
  schemaVersion: 4,
  sources: [{ id: "s1" as never, type: "book", authors: [{ kind: "person", family: "Ilić", given: "Ana" }], year: 2001, title: "Uvod u izmišljeno", place: "Zagreb", publisher: "Izmišljena naklada" }],
  nodes: [
    { type: "heading", id: id(1), level: 1, children: [t("Uvod & svrha")] },
    { type: "paragraph", id: id(2), children: [t(`Autorica piše: „${QUOTE}” `), { type: "citation", sourceId: "s1" as never, locator: "12" }, t(". Vidi "), { type: "crossReference", targetId: id(4) }, t(" i "), { type: "inlineFormula", tex: "x^2" }, t(" 50% _ ")] },
    { type: "paragraph", id: id(3), children: [t("Kratko „premalo” "), { type: "citation", sourceId: "s1" as never }] },
    { type: "formula", id: id(4), tex: "\\frac{a}{b}" },
    { type: "bulletItem", id: id(5), children: [t("prva")] },
    { type: "bulletItem", id: id(6), children: [t("druga")] },
    { type: "codeBlock", id: id(7), language: "python", caption: "Zbroj", children: [t("print(1 + 1)")] },
    { type: "box", id: id(8), kind: "theorem", children: [{ type: "paragraph", id: id(9), children: [t("Tvrdnja.")] }] },
  ],
};

describe("findQuotes", () => {
  it("takes only long quotes followed by a citation", () => {
    expect(findQuotes(doc)).toEqual([{ blockId: id(2), quote: QUOTE, sourceId: "s1", locator: "12" }]);
  });
  it("ignores a citation that is too far away", () => {
    const far: CanonicalDocumentV4 = { ...doc, nodes: [{ type: "paragraph", id: id(2), children: [t(`„${QUOTE}” ${"x".repeat(70)}`), { type: "citation", sourceId: "s1" as never }] }] };
    expect(findQuotes(far)).toEqual([]);
  });
});

describe("checkQuote", () => {
  const found = findQuotes(doc)[0]!;
  it("gives no verdict without a proof or note", () => {
    expect(checkQuote(found, undefined)).toEqual({ kind: "none" });
    expect(checkQuote(found, { proofs: [], notes: [] })).toEqual({ kind: "none" });
    expect(checkQuote(found, { proofs: [], notes: [{ text: "prekratko" }] })).toEqual({ kind: "none" });
  });
  it("confirms a quote that is in the proof, on the quoted page", () => {
    const v = checkQuote(found, { proofs: [{ page: "12", text: `Neki tekst. ${QUOTE}, kaže se dalje u knjizi.` }], notes: [] });
    expect(v).toMatchObject({ kind: "ok", message: stemHr.quote.matchesProof("12") });
  });
  it("names the other page when the proof has the text elsewhere", () => {
    const v = checkQuote(found, { proofs: [{ page: "14", text: `Neki tekst. ${QUOTE}, kaže se dalje u knjizi.` }], notes: [] });
    expect(v).toMatchObject({ kind: "page", message: stemHr.quote.pageDiffers("14", "12") });
  });
  it("confirms from a note longer than 20 characters", () => {
    expect(checkQuote(found, { proofs: [], notes: [{ text: `Bilješka: ${QUOTE} i još malo teksta.` }] })).toMatchObject({ kind: "ok", message: stemHr.quote.matchesNote });
  });
  it("says in milder words that the wording differs, never that it disagrees", () => {
    const v = checkQuote(found, { proofs: [{ page: "12", text: "Svaka pojava ima svoj razlog u prethodnoj pojavi kaže autor ovdje jasno" }], notes: [] });
    expect(v.kind).toBe("differs");
    if (v.kind === "differs") {
      expect(v.message).toContain("razlikuje se od teksta u priloženoj potvrdi");
      expect(v.message).toContain("uzrok");
      expect(v.message).not.toMatch(/ne slaže/i);
    }
  });
  it("says where it was not found", () => {
    const v = checkQuote(found, { proofs: [{ page: "3", text: "Potpuno drugi tekst o sasvim drugoj temi, bez ikakvog dodira s navodom." }], notes: [] });
    expect(v).toMatchObject({ kind: "missing" });
    expect(v.kind === "missing" && v.message).toContain("nije pronađen u priloženoj potvrdi");
  });
  it("reads the page number of a locator", () => {
    expect(locatorPage("str. 12–13")).toBe("12");
    expect(locatorPage(null)).toBeNull();
  });
});

describe("reviewQuotes", () => {
  const found = findQuotes(doc)[0]!;
  it("is empty without quotes", () => {
    expect(reviewQuotes({ ...doc, nodes: [] }, {}).summary).toBe(stemHr.review.empty);
  });
  it("says nothing could be compared when nothing is attached", () => {
    const r = reviewQuotes(doc, {});
    expect(r.summary).toBe(stemHr.review.unchecked);
    expect(r.checked).toBe(0);
  });
  it("counts N when all are confirmed and N of M otherwise; a dismissed mismatch is not open", () => {
    const ok = { s1: { proofs: [{ page: "12", text: QUOTE + " dalje u tekstu" }], notes: [] } };
    expect(reviewQuotes(doc, ok).summary).toBe("Potvrđeno: 1");
    const bad = { s1: { proofs: [{ page: "3", text: "Potpuno drugi tekst o sasvim drugoj temi, bez ikakvog dodira s navodom." }], notes: [] } };
    const r = reviewQuotes(doc, bad);
    expect(r.summary).toBe("0 od 1 potvrđeno");
    expect(r.open).toHaveLength(1);
    expect(reviewQuotes(doc, bad, new Set([dismissKey(found)])).open).toHaveLength(0);
  });
});

describe("buildTex", () => {
  const style = parseCitationStyle(fpzg);
  const tex = buildTex(doc, { title: "Izmišljeni rad", style });
  it("escapes special characters and labels the headings", () => {
    expect(texEscape("a_b & 50% #1")).toBe("a\\_b \\& 50\\% \\#1");
    expect(tex).toContain("\\section{Uvod \\& svrha}\\label{sec:" + id(1) + "}");
    expect(tex).toContain("50\\% \\_");
  });
  it("turns formulas, code, boxes, references and lists into LaTeX", () => {
    expect(tex).toContain("\\begin{equation}\\label{eq:" + id(4) + "}\n\\frac{a}{b}\n\\end{equation}");
    expect(tex).toContain("$x^2$");
    expect(tex).toContain("\\ref{eq:" + id(4) + "}");
    expect(tex).toContain("\\begin{lstlisting}[label={lst:" + id(7) + "},caption={Zbroj},language=Python]\nprint(1 + 1)\n\\end{lstlisting}");
    expect(tex).toContain("\\begin{teorem}\\label{box:" + id(8) + "}\nTvrdnja.\n\\end{teorem}");
    expect(tex).toContain("\\begin{itemize}\n\\item prva\n\\item druga\n\\end{itemize}");
  });
  it("cites from the institution's style and lists the cited source", () => {
    expect(tex).toContain("Ilić");
    expect(tex).toMatch(/\\section\*\{Literatura\}[\s\S]*Uvod u izmišljeno/);
  });
  it("is the same bytes for the same work, and a reference to nothing is marked", () => {
    expect(buildTex(doc, { title: "Izmišljeni rad", style })).toBe(tex);
    const lost: CanonicalDocumentV4 = { ...doc, nodes: [{ type: "paragraph", id: id(2), children: [{ type: "crossReference", targetId: id(99) }] }] };
    expect(buildTex(lost, { title: "", style })).toContain("[referenca?]");
  });
});
