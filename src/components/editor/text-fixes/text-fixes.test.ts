// @vitest-environment node
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { createEditorExtensionsV4 } from "@/editor";

import { reviewDocOf } from "../review/model";
import { runChecks } from "../review";
import { MAX_BATCH_EDITS, applyAllFixes, applyFix, nextFix, scanFixes } from "./fixes";
import { fixFor, stepAfter } from "./steps";

const id = (n: number) => `${String(n).repeat(8)}-0000-4000-8000-${String(n).repeat(12)}`;
type Run = string | { text: string; marks: { type: string; attrs?: Record<string, unknown> }[] };
const block = (n: number, runs: Run[], type = "paragraph") => ({
  type, attrs: { nodeId: id(n) },
  content: runs.map((r) => (typeof r === "string" ? { type: "text", text: r } : { type: "text", text: r.text, marks: r.marks })),
});
const pasted = (text: string): Run => ({ text, marks: [{ type: "paste", attrs: { pasteId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" } }] });
const imported = (text: string): Run => ({ text, marks: [{ type: "imported" }] });

const editors: Editor[] = [];
function make(blocks: ReturnType<typeof block>[]) {
  const editor = new Editor({ element: null, extensions: createEditorExtensionsV4(), content: { type: "doc", content: blocks } });
  editor.view.updateState(editor.state.reconfigure({ plugins: editor.extensionManager.plugins }));
  editors.push(editor);
  return editor;
}
afterEach(() => { while (editors.length) editors.pop()!.destroy(); });
const texts = (e: Editor) => e.state.doc.content.content.map((b) => b.textContent);

describe("scanFixes", () => {
  it("finds each kind of slip", () => {
    const e = make([block(1, ["Dva  razmaka , zarez,bez razmaka i \"navodnici\" kraj!!"])]);
    const kinds = scanFixes(e.state.doc).fixes.map((f) => f.kind).sort();
    expect(kinds).toEqual(["after", "before", "double", "quotes", "spaces"]);
  });

  it("leaves an ellipsis, numbers and clean text alone", () => {
    const e = make([block(1, ["Čekao je... pa 3,5 i 10:30 sati. Sve je uredno, kako treba."])]);
    expect(scanFixes(e.state.doc).fixes).toEqual([]);
  });

  it("leaves quotes, headings and an odd number of straight quotes alone", () => {
    const e = make([block(1, ["Dva  razmaka"], "quote"), block(2, ["Naslov  dva"], "heading"), block(3, ["jedan \" navodnik"])]);
    expect(scanFixes(e.state.doc).fixes).toEqual([]);
  });

  it("skips and counts slips in pasted and imported text", () => {
    const e = make([block(1, ["Moj tekst. ", pasted("Zalijepljeno  tekst ,tu"), " Opet moj  tekst."]), block(2, [imported("Uvezeno  tekst")])]);
    const scan = scanFixes(e.state.doc);
    expect(scan.fixes.map((f) => f.kind)).toEqual(["spaces"]);
    expect(scan.skippedProvenance).toBe(4);
    const after = applyAllFixes(e.state, scan);
    if (!after.ok) throw new Error("expected fixes");
    e.view.dispatch(after.tr);
    expect(texts(e)).toEqual(["Moj tekst. Zalijepljeno  tekst ,tu Opet moj tekst.", "Uvezeno  tekst"]);
  });
});

describe("applying", () => {
  it("one fix changes one slip", () => {
    const e = make([block(1, ["Dva  razmaka i ,zarez"])]);
    const scan = scanFixes(e.state.doc);
    const out = applyFix(e.state, scan, scan.fixes[0]!.id);
    if (!out.ok) throw new Error("fix");
    e.view.dispatch(out.tr);
    expect(texts(e)).toEqual(["Dva razmaka i ,zarez"]);
  });

  it("fixes every kind and pairs the quotes", () => {
    const e = make([block(1, ["Rekao je \"da\" , a onda,otišao!!  Kraj"])]);
    const out = applyAllFixes(e.state, scanFixes(e.state.doc));
    if (!out.ok) throw new Error("fix");
    e.view.dispatch(out.tr);
    expect(texts(e)).toEqual(["Rekao je „da” , a onda, otišao! Kraj".replace("” , a", "”, a")]);
  });

  it("one Ctrl+Z takes the whole batch back", () => {
    const e = make([block(1, ["Prvi  odlomak ,ovdje."]), block(2, ["Drugi,odlomak  ovdje."])]);
    const before = texts(e);
    const out = applyAllFixes(e.state, scanFixes(e.state.doc));
    if (!out.ok) throw new Error("fix");
    e.view.dispatch(out.tr);
    expect(texts(e)).not.toEqual(before);
    e.commands.undo();
    expect(texts(e)).toEqual(before);
  });

  it("refuses a scan of an older document and keeps block ids", () => {
    const e = make([block(1, ["Dva  razmaka"])]);
    const scan = scanFixes(e.state.doc);
    e.view.dispatch(e.state.tr.insertText("x", 1));
    expect(applyAllFixes(e.state, scan)).toEqual({ ok: false, reason: "stale" });
    expect(e.state.doc.child(0).attrs["nodeId"]).toBe(id(1));
  });

  it("keeps bold on the text it fixes", () => {
    const e = make([block(1, [{ text: "Podebljano  tekst", marks: [{ type: "bold" }] }])]);
    const out = applyAllFixes(e.state, scanFixes(e.state.doc));
    if (!out.ok) throw new Error("fix");
    e.view.dispatch(out.tr);
    expect(e.state.doc.child(0).firstChild!.marks.map((m) => m.type.name)).toEqual(["bold"]);
    expect(texts(e)).toEqual(["Podebljano tekst"]);
  });
});

describe("walking", () => {
  it("nextFix wraps and is null for none", () => {
    const e = make([block(1, ["A  b ,c"])]);
    const { fixes } = scanFixes(e.state.doc);
    expect(nextFix(fixes, null)?.id).toBe(fixes[0]!.id);
    expect(nextFix(fixes, fixes[fixes.length - 1]!.id)?.id).toBe(fixes[0]!.id);
    expect(nextFix([], null)).toBeNull();
  });

  const doc = reviewDocOf([
    { kind: "paragraph", id: "a", text: "Dva  razmaka u prvom odlomku koji nije jako kratak ni pretjerano dug sad." },
    { kind: "paragraph", id: "b", text: "Drugi odlomak ,ima razmak ispred zareza i još nekoliko riječi da nije prekratak." },
  ]);
  const findings = runChecks(doc, ["fix"]);

  it("goes through the findings in order and then ends", () => {
    const first = stepAfter(findings, null)!;
    expect(first.index).toBe(0);
    const second = stepAfter(findings, first.finding.id)!;
    expect(second.finding.blockId).toBe("b");
    const third = stepAfter(findings, second.finding.id)!;
    expect(third.index).toBe(2);
    expect(stepAfter(findings, third.finding.id)).toBeNull();
    expect(stepAfter([], null)).toBeNull();
  });

  it("moves on to the next finding when the one shown was solved", () => {
    const first = findings[0]!;
    const rest = findings.filter((f) => f.id !== first.id);
    const next = stepAfter(rest, first.id, findings.map((f) => f.id))!;
    expect(next.finding.id).toBe(rest[0]!.id);
    expect(next.index).toBe(0);
  });

  it("offers a fix only for a finding of the writing kind", () => {
    const e = make([block(1, ["Dva  razmaka"])]);
    const fixes = scanFixes(e.state.doc).fixes;
    const f = { ...findings[0]!, blockId: id(1) };
    expect(fixFor(f, fixes)?.kind).toBe("spaces");
    expect(fixFor({ ...f, kind: "long" }, fixes)).toBeNull();
    expect(fixFor({ ...f, blockId: null }, fixes)).toBeNull();
  });
});

describe("review findings (Codex)", () => {
  it("a pair of quotes is one fix, applied whole", () => {
    const e = make([block(1, ["Rekao je \"da\" i otišao."])]);
    const scan = scanFixes(e.state.doc);
    expect(scan.fixes.map((f) => f.kind)).toEqual(["quotes"]);
    const out = applyFix(e.state, scan, scan.fixes[0]!.id);
    if (!out.ok) throw new Error("fix");
    e.view.dispatch(out.tr);
    expect(texts(e)).toEqual(["Rekao je „da” i otišao."]);
    expect(scanFixes(e.state.doc).fixes).toEqual([]);
  });

  it("a batch is bounded and a rescan offers the rest", () => {
    const e = make([block(1, [Array.from({ length: 1_200 }, () => "a  b").join(" ")])]);
    const scan = scanFixes(e.state.doc);
    expect(scan.fixes.length).toBe(1_200);
    const out = applyAllFixes(e.state, scan);
    if (!out.ok) throw new Error("fix");
    expect(out.count).toBe(MAX_BATCH_EDITS);
    e.view.dispatch(out.tr);
    expect(scanFixes(e.state.doc).fixes.length).toBe(200);
    e.commands.undo();
    expect(scanFixes(e.state.doc).fixes.length).toBe(1_200);
  });
});
