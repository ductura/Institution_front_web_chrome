// @vitest-environment node
import { Editor, type JSONContent } from "@tiptap/core";
import { Fragment, Slice } from "@tiptap/pm/model";
import { TextSelection, type Transaction } from "@tiptap/pm/state";
import { ReplaceStep } from "@tiptap/pm/transform";
import { describe, expect, it, vi } from "vitest";

import { createEditorExtensions, createEditorExtensionsV4 } from "../editor/schema";
import { SourceObserver, sourceOfChange } from "../editor/source";
import type { EvidenceSource } from "../document/forensics/evidence-segment-v2";

import { croatianQuote, CroatianQuotes, HIGH_DOUBLE, HIGH_SINGLE, LOW_DOUBLE, LOW_SINGLE } from "./croatian-quotes";
import { resetTypingTypographyForTest, setTypingTypography } from "./typing-switch";

/**
 * WEB-1605 part 1: Croatian quotation marks while typing. The pure rule
 * first, then the real editor with the evidence source observer, driven the
 * way prosemirror-view 1.42.6 drives it (keydown, beforeinput, then
 * handleTextInput or the DOM change). Invented text only.
 */

describe("croatianQuote", () => {
  it.each([
    ["", '"', LOW_DOUBLE],
    ["Rekla je ", '"', LOW_DOUBLE],
    ["(", '"', LOW_DOUBLE],
    ["Rekla je „dobro", '"', HIGH_DOUBLE],
    ["„jedan” i ", '"', LOW_DOUBLE],
    ["„Rekla je ", "'", LOW_SINGLE],
    ["„Rekla je ‚tako", "'", HIGH_SINGLE],
    ["„Rekla je ‚tako’ i ", "'", LOW_SINGLE],
  ])("after %j a typed %s is %s", (before, typed, mark) => {
    expect(croatianQuote(before, typed)).toBe(mark);
  });

  it.each([
    ["Rijec", '"'],
    ["Visina 5", '"'],
    ["Rijec", "'"],
    ["Rekla je ", "'"],
    ["„jedan” dva", "'"],
    ["„Rekla je ‚tako ", "'"],
    ["Tekst", "x"],
  ])("after %j a typed %s stays straight", (before, typed) => {
    expect(croatianQuote(before, typed)).toBeNull();
  });
});

type Spy = { preventDefault: ReturnType<typeof vi.fn> };
const domEvent = <T,>(type: string, extra: Record<string, unknown>) =>
  ({ type, isTrusted: true, preventDefault: vi.fn(), stopPropagation() {}, defaultPrevented: false, ...extra }) as unknown as T & Spy;
type Props = Record<string, unknown>;

function setup(content: JSONContent, v4 = false) {
  const observer = new SourceObserver();
  const editor = new Editor({
    element: null,
    extensions: [...(v4 ? createEditorExtensionsV4() : createEditorExtensions()), CroatianQuotes, observer.extension],
    content,
  });
  editor.view.updateState(editor.state.reconfigure({ plugins: editor.extensionManager.plugins }));
  const view = editor.view;
  const sources: { source: EvidenceSource; inserted: string }[] = [];
  editor.on("transaction", ({ transaction, appendedTransactions }) => {
    const all: Transaction[] = [transaction, ...appendedTransactions];
    if (!all.some((tr) => tr.docChanged)) return;
    const inserted = all.flatMap((tr) => tr.steps)
      .map((step) => (step instanceof ReplaceStep ? step.slice.content.textBetween(0, step.slice.content.size, "", "") : ""))
      .join("");
    sources.push({ source: sourceOfChange(all, observer.take(all)), inserted });
  });
  const props = (name: string) => editor.state.plugins.map((p) => (p.props as unknown as Props)[name]).filter((f): f is (...a: unknown[]) => unknown => typeof f === "function");
  const domHandler = (type: string, event: Event) =>
    editor.state.plugins.some((plugin) => {
      const handler = ((plugin.props as unknown as Props).handleDOMEvents as Record<string, (...args: unknown[]) => unknown> | undefined)?.[type];
      return handler ? Boolean(handler.call(plugin, view, event)) : false;
    });
  const t = {
    editor, sources,
    text: () => editor.state.doc.textContent,
    select(pos: number) {
      view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, pos)));
    },
    key(name: string) {
      const code = name.length === 1 ? name.toUpperCase().charCodeAt(0) : name === "Backspace" ? 8 : 0;
      const event = domEvent<KeyboardEvent>("keydown", { key: name, keyCode: code, which: code, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });
      return props("handleKeyDown").some((f) => Boolean(f(view, event)));
    },
    /** One character from the keyboard: keydown, beforeinput, then handleTextInput or the DOM change. */
    type(chars: string) {
      for (const char of chars) {
        t.key(char);
        domHandler("beforeinput", domEvent<InputEvent>("beforeinput", { inputType: "insertText", data: char, dataTransfer: null }));
        const { from, to } = editor.state.selection;
        if (!props("handleTextInput").some((f) => Boolean(f(view, from, to, char, () => editor.state.tr.insertText(char, from, to))))) {
          view.dispatch(editor.state.tr.insertText(char, from, to));
        }
      }
    },
    paste(text: string) {
      const slice = new Slice(Fragment.from(editor.schema.text(text)), 0, 0);
      const event = domEvent<ClipboardEvent>("paste", { clipboardData: { getData: () => "" } });
      if (domHandler("paste", event)) return;
      if (props("handlePaste").some((f) => Boolean(f(view, event, slice)))) return;
      view.dispatch(editor.state.tr.replaceSelection(slice).setMeta("paste", true).setMeta("uiEvent", "paste"));
    },
  };
  return t;
}

const paragraph = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: text ? [{ type: "text", text }] : [] }] });

/** An editor with `text` typed into an empty paragraph, so the paragraph has its node id. */
function typed(text: string) {
  const t = setup(paragraph(""));
  t.select(1);
  t.type(text);
  return t;
}

describe("CroatianQuotes in the editor", () => {
  it("typing a quoted sentence gives „…” and ‚…’ inside it", () => {
    const t = setup(paragraph(""));
    t.select(1);
    t.type(`Rekla je "znam 'tako' i to" pa ode.`);
    expect(t.text()).toBe("Rekla je „znam ‚tako’ i to” pa ode.");
  });

  it("with Tipografija dok tipkam switched off, every quote stays straight (ED-99)", () => {
    setTypingTypography(false, () => undefined);
    try {
      const t = setup(paragraph(""));
      t.select(1);
      t.type(`Rekla je "znam 'tako' i to" pa ode.`);
      expect(t.text()).toBe(`Rekla je "znam 'tako' i to" pa ode.`);
    } finally {
      resetTypingTypographyForTest();
    }
  });

  it("an apostrophe and the inch sign after a letter or digit stay straight", () => {
    const t = setup(paragraph(""));
    t.select(1);
    t.type(`rock'n'roll 5"`);
    expect(t.text()).toBe(`rock'n'roll 5"`);
  });

  it("a quote typed in a code block stays straight (criterion 1)", () => {
    const t = setup({ type: "doc", content: [{ type: "codeBlock", content: [{ type: "text", text: "x = " }] }] }, true);
    t.select(5);
    t.type(`"a" 'b'`);
    expect(t.text()).toBe(`x = "a" 'b'`);
  });

  it("pasted text keeps its straight quotes and is a paste", () => {
    const t = setup(paragraph(""));
    t.select(1);
    t.paste(`Navod "izmisljen"`);
    expect(t.text()).toBe(`Navod "izmisljen"`);
    expect(t.sources.map((s) => s.source)).toEqual(["paste"]);
  });

  it("the typed quote is an editor change and its conversion one unattributed change of one character", () => {
    const t = setup(paragraph(""));
    t.select(1);
    t.type(`a"b`);
    expect(t.text()).toBe("a\"b");
    t.type(` "c`);
    expect(t.text()).toBe("a\"b „c");
    expect(t.sources).toEqual([
      { source: "editor", inserted: "a" },
      { source: "editor", inserted: '"' },
      { source: "editor", inserted: "b" },
      { source: "editor", inserted: " " },
      { source: "editor", inserted: '"' },
      { source: "unattributed", inserted: LOW_DOUBLE },
      { source: "editor", inserted: "c" },
    ]);
  });

  it("undo first gives the straight quote back, then removes it", () => {
    const t = typed("Rekla je ");
    t.type(`"`);
    expect(t.text()).toBe("Rekla je „");
    t.editor.commands.undo();
    expect(t.text()).toBe(`Rekla je "`);
    t.editor.commands.undo();
    expect(t.text()).not.toContain('"');
  });

  it("Backspace right after the rule gives the straight quote back", () => {
    const t = typed("Rekla je ");
    t.type(`"`);
    expect(t.key("Backspace")).toBe(true);
    expect(t.text()).toBe(`Rekla je "`);
  });
});
