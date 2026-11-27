// @vitest-environment jsdom
// PIL-K-FUSNOTA: the student's editor opens the host's footnote dialog; inserting and
// editing a footnote gives the same document as the copied dialog did, and closing the
// dialog returns the caret to the text.
import { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { createEditorExtensionsV3, NODE_ID_ATTRIBUTE } from "../../../../../editor-core/src/editor/schema";
import { FootnoteDialog } from "../../../../../../src/components/editor/footnotes/FootnoteDialog.tsx";
import { useV3EditorDialogs } from "../../../../../../src/components/editor/footnotes/useV3EditorDialogs.tsx";
import { FootnoteDialogHost } from "./FootnoteHost";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { requestAnimationFrame?: (cb: () => void) => number }).requestAnimationFrame = (cb) => { cb(); return 0; };

// jsdom has no modal <dialog>: open/close just toggle the attribute.
HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close = function close() { this.removeAttribute("open"); };

const ID = "00000000-0000-4000-8000-000000000001";
let mount: HTMLDivElement | null = null;
let editor: Editor | null = null;
afterEach(() => { mount?.remove(); mount = null; editor?.destroy(); editor = null; });

const button = (label: string) => Array.from(document.querySelectorAll("button")).find((b) => b.textContent === label);
const click = async (label: string) => { const b = button(label); expect(b, label).toBeTruthy(); await act(async () => { b!.click(); }); };
const type = async (value: string) => {
  const field = document.querySelector("textarea")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

/** Runs insert then edit through the hook with the given dialog; returns the documents after each step. */
async function run(Dialog: ComponentType<never>) {
  const element = document.createElement("div");
  document.body.append(element);
  editor = new Editor({
    element, extensions: createEditorExtensionsV3(),
    content: { type: "doc", content: [{ type: "paragraph", attrs: { [NODE_ID_ATTRIBUTE]: ID }, content: [{ type: "text", text: "Izmišljeni odlomak." }] }] },
  });
  editor.commands.setTextSelection(5);
  let open: ((kind: "footnote" | "crossReference") => boolean) | undefined;
  const Harness = () => {
    const v3 = useV3EditorDialogs(editor, 3, Dialog as never);
    open = v3.openInsert;
    return createElement("div", null, v3.dialog);
  };
  mount = document.createElement("div");
  document.body.append(mount);
  const root = createRoot(mount);
  await act(async () => { root.render(createElement(Harness)); });

  await act(async () => { open!("footnote"); });
  await type("Prva izmišljena napomena.");
  await click("Umetni");
  const inserted = JSON.stringify(editor.getJSON());
  const focusAfterInsert = editor.view.dom.contains(document.activeElement);

  let at = -1;
  editor.state.doc.descendants((node, p) => { if (node.type.name === "footnote") at = p; });
  expect(at).toBeGreaterThan(-1);
  await act(async () => {
    editor!.view.dispatch(editor!.state.tr.setSelection(NodeSelection.create(editor!.state.doc, at)));
    editor!.view.dom.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  });
  await click("Uredi");
  await type("Druga izmišljena napomena.");
  await click("Spremi");
  const edited = JSON.stringify(editor.getJSON());
  const focusAfterEdit = editor.view.dom.contains(document.activeElement);
  await act(async () => { root.unmount(); });
  return { inserted, edited, focusAfterInsert, focusAfterEdit };
}

describe("footnote dialog in the editor", () => {
  it("gives the same document nodes with the host dialog as with the copied one", async () => {
    const before = await run(FootnoteDialog as never);
    mount?.remove(); editor?.destroy();
    const after = await run(FootnoteDialogHost as never);
    expect(after.inserted).toBe(before.inserted);
    expect(after.edited).toBe(before.edited);
    expect(after.inserted).toContain("Prva izmišljena napomena.");
    expect(after.edited).toContain("Druga izmišljena napomena.");
    expect(after.edited).not.toContain("Prva izmišljena napomena.");
  });

  it("returns focus to the editor when the dialog closes", async () => {
    const after = await run(FootnoteDialogHost as never);
    expect(after.focusAfterInsert).toBe(true);
    expect(after.focusAfterEdit).toBe(true);
  });
});

/** Opens the insert dialog on a focused editor, types, dismisses it with `dismiss`; returns what is left. */
async function openThenDismiss(dismiss: () => Promise<void>) {
  const element = document.createElement("div");
  document.body.append(element);
  editor = new Editor({
    element, extensions: createEditorExtensionsV3(),
    content: { type: "doc", content: [{ type: "paragraph", attrs: { [NODE_ID_ATTRIBUTE]: ID }, content: [{ type: "text", text: "Izmišljeni odlomak." }] }] },
  });
  editor.commands.setTextSelection(5);
  editor.view.focus();
  const before = JSON.stringify(editor.getJSON());
  let open: ((kind: "footnote" | "crossReference") => boolean) | undefined;
  const Harness = () => {
    const v3 = useV3EditorDialogs(editor, 3, FootnoteDialogHost as never);
    open = v3.openInsert;
    return createElement("div", null, v3.dialog);
  };
  mount = document.createElement("div");
  document.body.append(mount);
  const root = createRoot(mount);
  await act(async () => { root.render(createElement(Harness)); });
  await act(async () => { open!("footnote"); });
  expect(document.querySelector("dialog")).toBeTruthy();
  await type("Izmišljena napomena koja se ne umeće.");
  await dismiss();
  const result = {
    dialogGone: document.querySelector("dialog") === null,
    unchanged: JSON.stringify(editor.getJSON()) === before,
    focusInEditor: editor.view.dom.contains(document.activeElement),
  };
  await act(async () => { root.unmount(); });
  return result;
}

describe("dismissing the footnote dialog", () => {
  it("Odustani closes it, inserts nothing and returns the focus to the editor", async () => {
    expect(await openThenDismiss(() => click("Odustani"))).toEqual({ dialogGone: true, unchanged: true, focusInEditor: true });
  });

  it("Escape closes it, inserts nothing and returns the focus to the editor", async () => {
    const escape = async () => {
      await act(async () => { document.querySelector("dialog")!.dispatchEvent(new Event("cancel", { bubbles: false, cancelable: true })); });
    };
    expect(await openThenDismiss(escape)).toEqual({ dialogGone: true, unchanged: true, focusInEditor: true });
  });
});

describe("the student's editor", () => {
  const read = (...p: string[]) => readFileSync(join(import.meta.dirname, ...p), "utf8");
  it("passes the host dialog to the page and no longer relies on the copied one", () => {
    expect(read("..", "..", "student", "WorkEditorPage.tsx")).toMatch(/footnoteDialog=\{FootnoteDialogHost\}/);
  });
});

/** INT-24: the visible footnote mark is a button that opens the dialog by keyboard; the number is display only. */
describe("footnote mark in the editor", () => {
  async function setUp() {
    const element = document.createElement("div");
    document.body.append(element);
    editor = new Editor({
      element, extensions: createEditorExtensionsV3(),
      content: { type: "doc", content: [{ type: "paragraph", attrs: { [NODE_ID_ATTRIBUTE]: ID }, content: [
        { type: "text", text: "Izmišljeni odlomak." },
        { type: "footnote", attrs: { text: "Prva izmišljena napomena." } },
        { type: "footnote", attrs: { text: "Druga izmišljena napomena." } },
      ] }] },
    });
    const Harness = () => createElement("div", null, useV3EditorDialogs(editor, 3, FootnoteDialogHost as never).dialog);
    mount = document.createElement("div");
    document.body.append(mount);
    const root = createRoot(mount);
    await act(async () => { root.render(createElement(Harness)); });
    return root;
  }
  const marks = () => Array.from(editor!.view.dom.querySelectorAll<HTMLElement>("span[data-footnote]"));

  it.each(["Enter", " "])("%j on the focused second mark opens its dialog and leaves the document unchanged", async (key) => {
    const root = await setUp();
    const before = JSON.stringify(editor!.getJSON());
    const mark = marks()[1]!;
    expect(mark.getAttribute("aria-label")).toBe("Fusnota 2");
    await act(async () => { mark.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })); });
    expect(document.querySelector("dialog")?.textContent).toContain("Druga izmišljena napomena.");
    expect(document.querySelector("dialog")?.textContent).toContain("Fusnota 2");
    expect(JSON.stringify(editor!.getJSON())).toBe(before);
    await act(async () => { root.unmount(); });
  });

  it("another key on the mark opens nothing", async () => {
    const root = await setUp();
    await act(async () => { marks()[0]!.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true, cancelable: true })); });
    expect(document.querySelector("dialog")).toBeNull();
    await act(async () => { root.unmount(); });
  });
});
