// @vitest-environment jsdom
// ED-75: the bubble beside the selected text runs the editor's own paths. Every text here is invented.
import { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createEditorExtensionsV3 } from "@/editor";

import { SelectionBubble } from "./SelectionBubbleHost";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom measures nothing; ProseMirror asks text ranges where they stand when it scrolls to the selection.
const rect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) }) as DOMRect;
for (const proto of [Range.prototype, Element.prototype] as { getClientRects: unknown; getBoundingClientRect: unknown }[]) {
  proto.getClientRects ??= () => [rect()] as unknown as DOMRectList;
  proto.getBoundingClientRect ??= rect;
}

const WORK = "00000000-0000-4000-8000-0000000000e7";
const TEXT = "Izmišljena rečenica o vrtu.";
let editor: Editor | null = null;
let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount()); root = null; editor?.destroy(); editor = null;
  document.body.innerHTML = ""; localStorage.clear();
});

async function mount(version: number | undefined = 3) {
  const place = document.createElement("div");
  document.body.append(place);
  editor = new Editor({ element: place, extensions: createEditorExtensionsV3(), content: { type: "doc", content: [{
    type: "paragraph", attrs: { nodeId: "00000000-0000-4000-8000-000000000001" }, content: [{ type: "text", text: TEXT }] }] } });
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root?.render(createElement(SelectionBubble, { editor: editor!, workId: WORK, version, delay: 0 })); });
}

/** Selects "rečenica" (positions 12..20 in the paragraph) and lets the bubble settle. */
async function select(from = 12, to = 20) {
  await act(async () => {
    editor!.view.focus();
    editor!.view.dispatch(editor!.state.tr.setSelection(TextSelection.create(editor!.state.doc, from, to)));
    await new Promise((r) => setTimeout(r, 20));
  });
  if (from !== to) await vi.waitFor(() => expect(bubble()).not.toBeNull());
}
const bubble = () => document.querySelector<HTMLElement>('[role="toolbar"][aria-label="Radnje za označeni tekst"]');
const button = (name: string) => [...(bubble()?.querySelectorAll("button") ?? [])].find((b) => b.textContent === name)!;

describe("SelectionBubble", () => {
  it("shows the prototype's buttons over a selection and nothing over a caret", async () => {
    await mount();
    await select(5, 5);
    expect(bubble()).toBeNull();
    await select();
    expect([...bubble()!.querySelectorAll("button")].map((b) => b.textContent))
      .toEqual(["Komentar", "Navod", "U blok-citat", "U fusnotu", "Odloži"]);
  });

  it("leaves out U fusnotu before schema 3 is confirmed", async () => {
    await mount(2);
    await select();
    expect(button("U fusnotu")).toBeUndefined();
  });

  it("moves the selection into a footnote", async () => {
    await mount();
    await select();
    await act(async () => { button("U fusnotu").click(); });
    const notes: string[] = [];
    editor!.state.doc.descendants((n) => { if (n.type.name === "footnote") notes.push(n.attrs.text as string); });
    expect(notes).toEqual(["rečenica"]);
    expect(bubble()).toBeNull();
  });

  it("stashes the selection on this device and takes it out of the text", async () => {
    await mount();
    await select();
    await act(async () => { button("Odloži").click(); });
    expect(editor!.state.doc.textContent).toBe("Izmišljena  o vrtu.");
    expect(JSON.stringify(Object.values({ ...localStorage }))).toContain("rečenica");
  });

  it("turns a part of the paragraph into a quote", async () => {
    await mount();
    await select();
    await act(async () => { button("U blok-citat").click(); });
    const quotes: string[] = [];
    editor!.state.doc.descendants((n) => { if (n.type.name === "quote") quotes.push(n.textContent); });
    expect(quotes).toEqual(["rečenica"]);
  });
});
