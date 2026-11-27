// @vitest-environment jsdom
// ED-94: the prototype's Fraze, the dialog and putting a phrase at the caret. Invented text.
import { Editor } from "@tiptap/core";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { createEditorExtensionsV2 } from "@/editor";

import { hintsHr } from "../hints/messages.hr";
import { insertPhrase, PHRASE_GROUPS, phrasesHr as t } from "./phrases";
import { PhrasesDialog } from "./PhrasesDialog";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close = function close() { this.removeAttribute("open"); };

function editorWith(text: string, editable = true) {
  return new Editor({ element: document.createElement("div"), extensions: createEditorExtensionsV2(), editable, content: {
    type: "doc", content: [
      { type: "paragraph", attrs: { nodeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" }, content: text ? [{ type: "text", text }] : [] },
    ] } });
}
const selected = (editor: Editor) => editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to);

let editor: Editor | null = null;
let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(() => {
  editor?.destroy(); editor = null;
  act(() => root?.unmount()); root = null;
  host?.remove(); host = null;
});

describe("Fraze (ED-94)", () => {
  it("has the prototype's seven groups, Prijelaz fifth and the same as the hint's", () => {
    expect(PHRASE_GROUPS.map((g) => g.name)).toEqual(["Uvod i cilj", "Pregled literature", "Argument", "Ograda", "Prijelaz", "Primjer", "Zaključak"]);
    expect(PHRASE_GROUPS[4]!.phrases).toEqual(hintsHr.trans.list);
    expect(PHRASE_GROUPS.reduce((n, g) => n + g.phrases.length, 0)).toBe(26);
  });

  it("puts a phrase at the caret with a space, and selects its first …", () => {
    editor = editorWith("Izmišljen tekst.");
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    expect(insertPhrase(editor, "Prema …, …")).toBe(true);
    expect(editor.state.doc.textContent).toBe("Izmišljen tekst. Prema …, …");
    expect(selected(editor)).toBe("…");
    expect(editor.state.selection.from).toBe(1 + "Izmišljen tekst. Prema ".length);
  });

  it("adds no space at the start of a paragraph or after one, and replaces a selection", () => {
    editor = editorWith("");
    insertPhrase(editor, "Međutim, …");
    expect(editor.state.doc.textContent).toBe("Međutim, …");
    editor.destroy();
    editor = editorWith("Stara riječ");
    editor.commands.setTextSelection({ from: 7, to: 12 });
    insertPhrase(editor, "Primjerice, …");
    expect(editor.state.doc.textContent).toBe("Stara Primjerice, …");
  });

  it("leaves a submitted work alone", () => {
    editor = editorWith("Izmišljen tekst.", false);
    expect(insertPhrase(editor, "Zaključno, …")).toBe(false);
    expect(editor.state.doc.textContent).toBe("Izmišljen tekst.");
  });

  it("shows the groups as chips and gives the chosen phrase", () => {
    const picked: string[] = [];
    let closed = 0;
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() => { root!.render(h(PhrasesDialog, { onPick: (p) => picked.push(p), onClose: () => { closed++; } })); });
    expect(host.textContent).toContain(t.intro);
    const chips = [...host.querySelectorAll<HTMLButtonElement>("[aria-pressed]")];
    expect(chips.map((c) => c.textContent)).toEqual(PHRASE_GROUPS.map((g) => g.name));
    expect(chips[0]!.getAttribute("aria-pressed")).toBe("true");
    act(() => { chips[4]!.click(); });
    expect(chips[4]!.getAttribute("aria-pressed")).toBe("true");
    const phrase = [...host.querySelectorAll<HTMLButtonElement>("li button")].find((b) => b.textContent === "Nadalje, …")!;
    act(() => { phrase.click(); });
    expect(picked).toEqual(["Nadalje, …"]);
    const close = [...host.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === t.close)!;
    act(() => { close.click(); });
    expect(closed).toBe(1);
  });
});
