// @vitest-environment jsdom
// WEB-V21-STEM-LATEX-IZVOZ: the Izvezi item builds rad.tex in the browser from the editor's v4 work. Only invented text.
import { Editor, type JSONContent } from "@tiptap/core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { citationStyleOf } from "../citation-styles/catalog";
import { V4_CORE_EXTENSIONS } from "../../../../../editor-core/src/editor/extensions-v4";
import { createEditorExtensionsV3, createEditorExtensionsV4, NODE_ID_ATTRIBUTE } from "../../../../../editor-core/src/editor/schema";
import {
  assignmentIdFromPath, buildLatexOf, downloadLatex, latexMenuItem, latexStyleOf, texCitationsOf, type LatexStyle,
} from "./latex-export-menu";
import { stemHr } from "./messages.hr";

const rects = () => ({ length: 0, item: () => null, [Symbol.iterator]: function* () {} });
Range.prototype.getClientRects = rects as never;
Range.prototype.getBoundingClientRect = (() => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 })) as never;
Element.prototype.getClientRects = rects as never;

const made: Editor[] = [];
afterEach(() => { while (made.length) made.pop()!.destroy(); vi.restoreAllMocks(); });

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const content: JSONContent = {
  type: "doc",
  content: [
    { type: "heading", attrs: { [NODE_ID_ATTRIBUTE]: ID(1), level: 1 }, content: [{ type: "text", text: "Uvod" }] },
    { type: "paragraph", attrs: { [NODE_ID_ATTRIBUTE]: ID(2) }, content: [{ type: "text", text: "Izmišljena tvrdnja " }, { type: "inlineFormula", attrs: { tex: "x^2" } }] },
    { type: "formula", attrs: { [NODE_ID_ATTRIBUTE]: ID(3), tex: "\\frac{a}{b}" } },
  ],
};

function v4(json: JSONContent = content): Editor {
  const element = document.createElement("div");
  document.body.append(element);
  const e = new Editor({ element, enableCoreExtensions: V4_CORE_EXTENSIONS, extensions: createEditorExtensionsV4(), content: json });
  made.push(e);
  return e;
}
function v3(): Editor {
  const element = document.createElement("div");
  document.body.append(element);
  const e = new Editor({ element, extensions: createEditorExtensionsV3(), content: { type: "doc", content: [{ type: "paragraph", attrs: { [NODE_ID_ATTRIBUTE]: ID(2) }, content: [{ type: "text", text: "Izmišljeni odlomak." }] }] } });
  made.push(e);
  return e;
}
const READY: LatexStyle = { kind: "ready", style: citationStyleOf("apa")! };

describe("latexMenuItem", () => {
  it("is on for a v4 work with the style ready", () => {
    expect(latexMenuItem(v4(), 4, READY)).toEqual({ id: "latex", label: "LaTeX (rad.tex)", disabled: false });
  });
  it("is off with a reason when the work is not in v4 (also when the version lies about a v3 schema)", () => {
    expect(latexMenuItem(v3(), 3, READY)).toMatchObject({ disabled: true, hint: stemHr.latex.menuNeedsV4 });
    expect(latexMenuItem(v3(), 4, READY)).toMatchObject({ disabled: true, hint: stemHr.latex.menuNeedsV4 });
    expect(latexMenuItem(v4(), undefined, READY)).toMatchObject({ disabled: true, hint: stemHr.latex.menuNeedsV4 });
  });
  it("is off with its own reason while the style loads or when it cannot be read, and without an editor", () => {
    expect(latexMenuItem(v4(), 4, { kind: "loading" })).toMatchObject({ disabled: true, hint: stemHr.latex.menuStyleLoading });
    expect(latexMenuItem(v4(), 4, { kind: "failed" })).toMatchObject({ disabled: true, hint: stemHr.latex.menuStyleFailed });
    expect(latexMenuItem(null, 4, READY).disabled).toBe(true);
    const gone = v4(); gone.destroy();
    expect(latexMenuItem(gone, 4, READY).disabled).toBe(true);
  });
});

describe("buildLatexOf", () => {
  it("gives the same text for the same work, with the formula as $…$ and the equation for the block", () => {
    const a = buildLatexOf(v4(), 4, READY, "Izmišljeni rad");
    const b = buildLatexOf(v4(), 4, READY, "Izmišljeni rad");
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.tex).toBe(b.tex);
    expect(a.tex).toContain("$x^2$");
    expect(a.tex).toContain("\\begin{equation}");
    expect(a.tex).toContain("\\frac{a}{b}");
    expect(a.tex).toContain("\\section{Uvod}");
  });
  it("changes with the work (a test that fails without the export reading the editor)", () => {
    const first = buildLatexOf(v4(), 4, READY);
    const edited = v4({ type: "doc", content: [{ type: "paragraph", attrs: { [NODE_ID_ATTRIBUTE]: ID(2) }, content: [{ type: "text", text: "Sasvim drugi tekst." }] }] });
    const second = buildLatexOf(edited, 4, READY);
    expect(first.ok && second.ok && first.tex !== second.tex).toBe(true);
    expect(second.ok && second.tex).toContain("Sasvim drugi tekst.");
  });
  it("refuses a v3 work and an unready style instead of building something else", () => {
    expect(buildLatexOf(v3(), 3, READY)).toEqual({ ok: false, reason: stemHr.latex.menuNeedsV4 });
    expect(buildLatexOf(v4(), 4, { kind: "loading" })).toEqual({ ok: false, reason: stemHr.latex.menuStyleLoading });
  });
});

describe("downloadLatex", () => {
  it("starts a download named rad.tex for a v4 work and none otherwise", () => {
    const names: string[] = [];
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:x");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function click(this: HTMLAnchorElement) { names.push(this.download); });
    expect(downloadLatex(v4(), 4, READY)).toBe(true);
    expect(names).toEqual(["rad.tex"]);
    expect(downloadLatex(v3(), 3, READY)).toBe(false);
    expect(names).toEqual(["rad.tex"]);
  });
  it("reports a refusing browser as false", () => {
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => { throw new Error("no"); });
    expect(downloadLatex(v4(), 4, READY)).toBe(false);
  });
});

describe("style and address", () => {
  it("reads the assignment from the work address only", () => {
    expect(assignmentIdFromPath("/rad/abc")).toBe("abc");
    expect(assignmentIdFromPath("/app/web/rad/abc/")).toBe("abc");
    expect(assignmentIdFromPath("/rad/abc/predaja")).toBeNull();
    expect(assignmentIdFromPath("/nastavnik/rad/abc")).toBeNull();
  });
  it("keeps loading, error and a style apart, and the default style when there is no assignment", () => {
    expect(latexStyleOf({ kind: "loading" })).toEqual({ kind: "loading" });
    expect(latexStyleOf({ kind: "error" })).toEqual({ kind: "failed" });
    expect(latexStyleOf(null).kind).toBe("ready");
    const style = citationStyleOf("ieee")!;
    expect(latexStyleOf({ kind: "style", id: "ieee", style })).toEqual({ kind: "ready", style });
  });
  it("cites through the institution's style", () => {
    const source = { id: ID(9), authors: [{ kind: "person", family: "Primjer", given: "Ana" }], title: "Izmišljeni naslov", year: 2020, type: "book", place: "Zagreb", publisher: "Izmišljena naklada" } as never;
    const apa = texCitationsOf(citationStyleOf("apa")!);
    expect(apa.inText(source)).toContain("Primjer");
    expect(apa.entry(source)).toContain("Izmišljeni naslov");
    expect(apa.order([source])).toHaveLength(1);
  });
});
