// @vitest-environment jsdom
// ED-91: the right-click menu in the text runs the same actions as the bubble. Every text here is invented.
import { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { createEditorExtensionsV3 } from "@/editor";

import { textMenuEntries } from "../toolbar/context-menu-model";
import { TextMenu } from "./TextMenu";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom measures nothing; ProseMirror asks text ranges where they stand when it scrolls to the selection.
const rect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) }) as DOMRect;
for (const proto of [Range.prototype, Element.prototype] as { getClientRects: unknown; getBoundingClientRect: unknown }[]) {
  proto.getClientRects ??= () => [rect()] as unknown as DOMRectList;
  proto.getBoundingClientRect ??= rect;
}

const WORK = "00000000-0000-4000-8000-0000000000e8";
let editor: Editor | null = null;
let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount()); root = null; editor?.destroy(); editor = null;
  document.body.innerHTML = ""; localStorage.clear();
});

async function mount(editable = true) {
  const place = document.createElement("div");
  document.body.append(place);
  editor = new Editor({ element: place, editable, extensions: createEditorExtensionsV3(), content: { type: "doc", content: [{
    type: "paragraph", attrs: { nodeId: "00000000-0000-4000-8000-000000000001" },
    content: [{ type: "text", text: "Izmišljena rečenica o vrtu." }] }] } });
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root?.render(createElement(TextMenu, { editor: editor!, workId: WORK, version: 3 })); });
}

/** A keyboard right click (no pointer position) over the current selection. */
async function rightClick(init: MouseEventInit = {}) {
  const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 0, clientY: 0, ...init });
  await act(async () => { editor!.view.dom.dispatchEvent(event); });
  return event;
}
const select = (from: number, to: number) =>
  editor!.view.dispatch(editor!.state.tr.setSelection(TextSelection.create(editor!.state.doc, from, to)));
const menu = () => document.querySelector<HTMLElement>('[role="menu"][aria-label="Izbornik teksta"]');
const item = (name: string) => [...(menu()?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
  .find((b) => b.querySelector("span")?.textContent === name);

describe("TextMenu", () => {
  it("offers the selected-text items and moves the selection into a quote", async () => {
    await mount();
    select(12, 20);
    const event = await rightClick();
    expect(event.defaultPrevented).toBe(true);
    expect(item("U fusnotu")?.getAttribute("aria-disabled")).toBeNull();
    await act(async () => { item("U blok-citat")!.click(); });
    expect(menu()).toBeNull();
    const quotes: string[] = [];
    editor!.state.doc.descendants((n) => { if (n.type.name === "quote") quotes.push(n.textContent); });
    expect(quotes).toEqual(["rečenica"]);
  });

  it("puts a mark to come back to at the caret", async () => {
    await mount();
    select(12, 12);
    await rightClick();
    await act(async () => { item("Za provjeru")!.click(); });
    expect(editor!.state.doc.textContent).toBe("Izmišljena [?] rečenica o vrtu.");
  });

  it("keeps the browser's menu on Shift and in a work that cannot be written in", async () => {
    await mount();
    expect((await rightClick({ shiftKey: true })).defaultPrevented).toBe(false);
    expect(menu()).toBeNull();
    act(() => root?.unmount()); root = null; editor?.destroy();
    await mount(false);
    expect((await rightClick()).defaultPrevented).toBe(false);
    expect(menu()).toBeNull();
  });
});

describe("textMenuEntries flags", () => {
  const base = { role: "student" as const, editable: true, hasSelection: true, canComment: true };
  const disabled = (e: ReturnType<typeof textMenuEntries>, id: string) => e?.find((x) => x.kind === "item" && x.id === id);
  it("greys out what cannot be done there", () => {
    const e = textMenuEntries({ ...base, footnote: false, inQuote: true });
    expect(disabled(e, "toFootnote")).toMatchObject({ disabled: true });
    expect(disabled(e, "toQuote")).toMatchObject({ disabled: true });
    expect(disabled(textMenuEntries(base), "toFootnote")).toMatchObject({ disabled: false });
  });
});
