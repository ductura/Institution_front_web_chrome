// @vitest-environment jsdom
// ED-111: "Fraze" (prototype app.js `PHRASES`, dialog `phrases`, action `phrIns`). Invented text only.
import { Editor, type JSONContent } from "@tiptap/core";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createEditorExtensionsV3 } from "../../../../../editor-core/src/editor/schema";
import { insertPhrase, PHRASES } from "./phrases-model";
import { PhrasesDialog } from "./PhrasesDialog";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
  const rects = () => ({ length: 0, item: () => null, [Symbol.iterator]: function* () {} });
  Range.prototype.getClientRects = rects as never;
  Range.prototype.getBoundingClientRect = (() => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 })) as never;
  Element.prototype.getClientRects = rects as never;
});

const made: Editor[] = [];
const roots: Root[] = [];
afterEach(() => {
  act(() => { while (roots.length) roots.pop()!.unmount(); });
  while (made.length) made.pop()!.destroy();
  document.body.innerHTML = "";
  vi.useRealTimers();
});

const p = (text: string): JSONContent => ({ type: "paragraph", content: text ? [{ type: "text", text }] : [] });

function editorWith(text: string): Editor {
  const element = document.createElement("div");
  document.body.append(element);
  const e = new Editor({ element, extensions: createEditorExtensionsV3(), content: { type: "doc", content: [p(text)] } });
  e.commands.setTextSelection(e.state.doc.content.size - 1);
  made.push(e);
  return e;
}
const selected = (e: Editor) => e.state.doc.textBetween(e.state.selection.from, e.state.selection.to);

describe("the phrases", () => {
  it("are the prototype's seven kinds, Prijelaz fifth", () => {
    expect(PHRASES.map(([name]) => name)).toEqual(["Uvod i cilj", "Pregled literature", "Argument", "Ograda", "Prijelaz", "Primjer", "Zaključak"]);
    expect(PHRASES.flatMap(([, list]) => list)).toHaveLength(26);
  });
});

describe("insertPhrase", () => {
  it("puts a space before the phrase after a word and selects its first …", () => {
    const e = editorWith("Ovo je prva misao.");
    expect(insertPhrase(e, "Iz toga proizlazi da …")).toBe(true);
    expect(e.getText()).toBe("Ovo je prva misao. Iz toga proizlazi da …");
    expect(selected(e)).toBe("…");
  });
  it("adds no space at the start of an empty paragraph or after a space", () => {
    const empty = editorWith("");
    insertPhrase(empty, "Primjerice, …");
    expect(empty.getText()).toBe("Primjerice, …");
    const spaced = editorWith("Tekst ");
    insertPhrase(spaced, "Prema …, …");
    expect(spaced.getText()).toBe("Tekst Prema …, …");
    expect(spaced.state.selection.from).toBe(1 + "Tekst Prema ".length);
  });
  it("writes nothing into a locked editor or without one", () => {
    const e = editorWith("A");
    e.setEditable(false);
    expect(insertPhrase(e, "Međutim, …")).toBe(false);
    expect(e.getText()).toBe("A");
    expect(insertPhrase(null, "Međutim, …")).toBe(false);
  });
});

describe("PhrasesDialog", () => {
  function open(e: Editor, onClose = vi.fn()) {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    roots.push(root);
    act(() => root.render(createElement(PhrasesDialog, { editor: e, onClose })));
    return onClose;
  }
  const buttons = () => [...document.querySelectorAll("button")];
  const byText = (text: string) => buttons().find((b) => b.textContent === text)!;

  it("shows the first kind, changes kind on a chip, and inserts the chosen phrase after closing", () => {
    vi.useFakeTimers();
    const e = editorWith("Analiza.");
    const onClose = open(e);
    expect(byText("Uvod i cilj").getAttribute("aria-pressed")).toBe("true");
    expect(byText("Cilj je ovog rada …")).toBeTruthy();
    act(() => byText("Zaključak").click());
    expect(byText("Zaključak").getAttribute("aria-pressed")).toBe("true");
    act(() => byText("Ograničenje je ovog rada …").click());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(e.getText()).toBe("Analiza.");
    act(() => { vi.runAllTimers(); });
    expect(e.getText()).toBe("Analiza. Ograničenje je ovog rada …");
    expect(selected(e)).toBe("…");
  });
  it("closes on Zatvori without writing", () => {
    const e = editorWith("Tekst.");
    const onClose = open(e);
    act(() => byText("Zatvori").click());
    expect(onClose).toHaveBeenCalled();
    expect(e.getText()).toBe("Tekst.");
  });
});
