// @vitest-environment jsdom
// ED-31 (P2-1b): the student's toolbar knows where the cursor is (the context button), sets the text size on the
// screen, and gives a phone "Brzi alati" only with the actions this editor has.
import { Editor, type JSONContent } from "@tiptap/core";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createEditorExtensionsV3 } from "../../../../../editor-core/src/editor/schema";
import { stateOf } from "../../../../../../src/components/editor/EditorToolbarFor.tsx";
import { EditorToolbarHost } from "./EditorToolbarHost";
import { toolbarBehaviourHr as t } from "./messages.hr";
import {
  applyZoom, cursorPlaceOf, HIDDEN_QUICK_TOOLS, hiddenContextActions, insertDictatedPhrase, quickMoreItems, runContextAction, textSizeItems,
  toolbarCommands, toolbarStateOf,
} from "./StudentToolbar";
import { DEFAULT_PREFS } from "./toolbar-prefs";

const made: Editor[] = [];
afterEach(() => { while (made.length) made.pop()!.destroy(); });

const p = (text: string): JSONContent => ({ type: "paragraph", content: [{ type: "text", text }] });
const h = (level: 1 | 2 | 3, text: string): JSONContent => ({ type: "heading", attrs: { level }, content: [{ type: "text", text }] });

/** An editor over `blocks` with the cursor inside the block at `at`. */
function editorWith(blocks: JSONContent[], at = 0): Editor {
  const element = document.createElement("div");
  document.body.append(element);
  const e = new Editor({ element, extensions: createEditorExtensionsV3(), content: { type: "doc", content: blocks } });
  let pos = 1;
  e.state.doc.forEach((node, offset, index) => { if (index === at) pos = offset + 1; });
  e.commands.setTextSelection(pos);
  made.push(e);
  return e;
}
const texts = (e: Editor) => e.getJSON().content!.map((b) => `${b.type}${b.attrs?.level ?? ""}:${(b.content?.[0] as { text?: string } | undefined)?.text ?? ""}`);

describe("where the cursor is", () => {
  it("is text in a paragraph, and no button for the work's title", () => {
    expect(cursorPlaceOf(stateOf(editorWith([p("Odlomak.")])))).toEqual({ kind: "text" });
    expect(cursorPlaceOf(stateOf(editorWith([h(1, "Naslov rada")])))).toEqual({ kind: "heading", level: 1 });
  });

  it("reads the chapter and the subchapter as the design's levels 2 and 3", () => {
    expect(cursorPlaceOf(stateOf(editorWith([h(2, "Uvod")])))).toEqual({ kind: "heading", level: 2 });
    expect(cursorPlaceOf(stateOf(editorWith([h(3, "Pojmovi")])))).toEqual({ kind: "heading", level: 3 });
  });

  it("reads a quote and a list item", () => {
    const q = editorWith([p("Citat.")]);
    toolbarCommands(q).toggleQuote();
    expect(cursorPlaceOf(stateOf(q))).toEqual({ kind: "quote" });
    const l = editorWith([p("Stavka.")]);
    toolbarCommands(l).toggleBulletList();
    expect(cursorPlaceOf(stateOf(l))).toEqual({ kind: "list" });
  });
});

describe("the context button's actions", () => {
  it("sets the heading's level", () => {
    const e = editorWith([h(2, "Uvod")]);
    runContextAction(e, "heading.level3");
    expect(texts(e)).toEqual(["heading3:Uvod"]);
    runContextAction(e, "heading.level2");
    expect(texts(e)).toEqual(["heading2:Uvod"]);
  });

  it("moves the chapter with its text down and up", () => {
    const e = editorWith([h(2, "Prvo"), p("a"), h(2, "Drugo"), p("b")], 0);
    runContextAction(e, "heading.down");
    expect(texts(e)).toEqual(["heading2:Drugo", "paragraph:b", "heading2:Prvo", "paragraph:a"]);
    runContextAction(e, "heading.up");
    expect(texts(e)).toEqual(["heading2:Prvo", "paragraph:a", "heading2:Drugo", "paragraph:b"]);
  });

  it("brings a quote back to a paragraph and leaves a list", () => {
    const q = editorWith([p("Citat.")]);
    toolbarCommands(q).toggleQuote();
    runContextAction(q, "quote.back");
    expect(stateOf(q).quote).toBe(false);
    const l = editorWith([p("Stavka.")]);
    toolbarCommands(l).toggleBulletList();
    runContextAction(l, "list.leave");
    expect(stateOf(l).bulletItem).toBe(false);
  });

  it("opens the cross-reference dialog from the shell", () => {
    const open = vi.fn();
    runContextAction(editorWith([h(2, "Uvod")]), "heading.xref", open);
    expect(open).toHaveBeenCalledOnce();
  });

  it("changes nothing while the editor cannot be written in", () => {
    const e = editorWith([h(2, "Prvo"), p("a"), h(2, "Drugo"), p("b")], 0);
    e.setEditable(false);
    const before = JSON.stringify(e.getJSON());
    for (const id of ["heading.level3", "heading.down"] as const) runContextAction(e, id);
    expect(JSON.stringify(e.getJSON())).toBe(before);
    expect(() => runContextAction(null, "heading.down")).not.toThrow();
  });

  it("hides the citation action, and the cross-reference without v3", () => {
    expect(hiddenContextActions(true)).toEqual(["quote.cite"]);
    expect(hiddenContextActions(false)).toEqual(["quote.cite", "heading.xref"]);
  });

  it("draws the button only while one of its actions is left", () => {
    const e = editorWith([p("Stavka.")]);
    const render = (hideContext: string[]) => renderToStaticMarkup(createElement(EditorToolbarHost, {
      state: toolbarStateOf(stateOf(e)), commands: toolbarCommands(e),
      behaviour: { prefs: DEFAULT_PREFS, onPrefs: () => undefined, place: { kind: "list" }, hideContext: hideContext as never },
    }));
    expect(render([])).toContain(t.contextListDescription);
    expect(render(["list.leave"])).not.toContain(t.contextListDescription);
  });
});

describe("text size on the screen", () => {
  it("is off at the ends of the steps, and Veći says the size now", () => {
    expect(textSizeItems(1)).toEqual([
      { id: "textSmaller", label: t.textSmaller, disabled: false },
      { id: "textLarger", label: `${t.textLarger} (100 %)`, disabled: false },
    ]);
    expect(textSizeItems(0.9)[0]!.disabled).toBe(true);
    expect(textSizeItems(1.5)[1]!.disabled).toBe(true);
  });

  it("puts the size on <html> and leaves no trace at 100 %", () => {
    const root = document.createElement("html");
    applyZoom(1.3, root);
    expect(root.getAttribute("data-text-size")).toBe("130");
    expect(root.style.getPropertyValue("--tz")).toBe("1.3");
    applyZoom(1, root);
    expect(root.hasAttribute("data-text-size")).toBe(false);
    expect(root.style.getPropertyValue("--tz")).toBe("");
  });
});

describe("Brzi alati on a phone", () => {
  it("leaves out Komentar, which this editor cannot do yet; Navod opens the picker (ED-100)", () => {
    expect(HIDDEN_QUICK_TOOLS).toEqual(["comment"]);
  });

  it("offers redo, bold and italic in Više, redo only when the editor can", () => {
    const e = editorWith([p("Odlomak.")]);
    expect(quickMoreItems(stateOf(e))).toEqual([
      { id: "redo", label: t.mobileRedo, disabled: true },
      { id: "bold", label: t.mobileBold, disabled: false },
      { id: "italic", label: t.mobileItalic, disabled: false },
    ]);
    e.commands.setTextSelection({ from: 1, to: 4 });
    toolbarCommands(e).toggleBold();
    toolbarCommands(e).undo();
    toolbarCommands(e).toggleItalic();
    const items = quickMoreItems(stateOf(e));
    expect(items.find((i) => i.id === "italic")!.label).toBe(`✓ ${t.mobileItalic}`);
  });
});

// ED-R18: dictation is mounted in the student's toolbar; a final phrase is typed at the caret.
describe("insertDictatedPhrase (ED-R18)", () => {
  it("types the phrase with a space at the caret", () => {
    const e = editorWith([p("Pocetak")], 0);
    e.commands.setTextSelection(e.state.doc.content.size - 1);
    expect(insertDictatedPhrase(e, "  novi tekst ")).toBe(true);
    expect(e.getText()).toBe("Pocetaknovi tekst ");
  });
  it("refuses an empty phrase, a locked editor and no editor", () => {
    const e = editorWith([p("A")], 0);
    expect(insertDictatedPhrase(e, "   ")).toBe(false);
    e.setEditable(false);
    expect(insertDictatedPhrase(e, "x")).toBe(false);
    expect(e.getText()).toBe("A");
    expect(insertDictatedPhrase(null, "x")).toBe(false);
  });
});
