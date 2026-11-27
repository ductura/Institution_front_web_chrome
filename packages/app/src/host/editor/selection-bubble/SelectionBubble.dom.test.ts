// @vitest-environment jsdom
// ED-109: the bubble beside a selection (prototype #selBub). Invented texts only.
import { Editor } from "@tiptap/core";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createEditorExtensionsV3 } from "../../../../../editor-core/src/editor/schema";
import { onCiteOpen } from "@/components/editor/citations/open-cite";
import { parseStash, storageKey } from "../left/left-model";
import { bubblePlace, bubbleText } from "./bubble-model";
import { selectionBubbleHr as t } from "./messages.hr";
import { SelectionBubble } from "./SelectionBubbleHost";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TEXT = "Kišni vrt zadržava vodu s krova.";
const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); } };
};

describe("ED-109 balončić uz označeni tekst", () => {
  let root: Root | undefined;
  let editor: Editor | undefined;
  afterEach(() => { act(() => root?.unmount()); editor?.destroy(); root = undefined; editor = undefined; document.body.innerHTML = ""; });

  const mount = async (opts: { editable?: boolean; store?: ReturnType<typeof memory> | null } = {}) => {
    const place = document.createElement("div");
    document.body.append(place);
    editor = new Editor({ element: place, extensions: createEditorExtensionsV3(), editable: opts.editable ?? true,
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: TEXT }] }] } });
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    const store = opts.store === undefined ? memory() : opts.store;
    await act(async () => { root?.render(h(SelectionBubble, { editor: editor!, workId: "w1", version: 3, store: () => store, delay: 0 })); });
    return { store };
  };
  // "Kišni vrt" is positions 1 to 10 in the first paragraph.
  const select = async (from: number, to: number) => {
    await act(async () => { editor!.commands.setTextSelection({ from, to }); await new Promise((r) => setTimeout(r, 5)); });
  };
  const bubble = () => document.querySelector("[role='toolbar']");
  const button = (label: string) => [...document.querySelectorAll("button")].find((b) => b.textContent === label) as HTMLButtonElement;

  it("shows the four actions after a selection of at least three characters, and not for less", async () => {
    await mount();
    await select(1, 3);
    expect(bubble()).toBeNull();
    await select(1, 10);
    expect(bubble()?.getAttribute("aria-label")).toBe(t.label);
    expect([...bubble()!.querySelectorAll("button")].map((b) => b.textContent)).toEqual([t.cite, t.toQuote, t.toFootnote, t.stash]);
  });

  it("stays away from a work that cannot be written", async () => {
    await mount({ editable: false });
    await select(1, 10);
    expect(bubble()).toBeNull();
  });

  it("Odloži moves the text to Odloženo on this device and out of the work", async () => {
    const { store } = await mount();
    await select(1, 10);
    await act(async () => { button(t.stash).click(); });
    expect(parseStash(JSON.parse(store!.getItem(storageKey("stash", "w1"))!)).map((i) => i.text)).toEqual(["Kišni vrt"]);
    expect(editor!.getText()).not.toContain("Kišni vrt");
    expect(bubble()).toBeNull();
  });

  it("Odloži keeps the text when the browser refuses to write", async () => {
    await mount({ store: null });
    await select(1, 10);
    await act(async () => { button(t.stash).click(); });
    expect(editor!.getText()).toContain("Kišni vrt");
  });

  it("U fusnotu puts the selected words into a footnote in their place", async () => {
    await mount();
    await select(1, 10);
    await act(async () => { button(t.toFootnote).click(); });
    const notes: string[] = [];
    editor!.state.doc.descendants((node) => { if (node.type.name === "footnote") notes.push(String(node.attrs.text)); });
    expect(notes).toEqual(["Kišni vrt"]);
    expect(editor!.getText()).not.toContain("Kišni vrt");
  });

  it("U blok-citat turns the selection into a quote", async () => {
    await mount();
    await select(1, TEXT.length + 1);
    await act(async () => { button(t.toQuote).click(); });
    expect(editor!.state.doc.firstChild?.type.name).toBe("quote");
  });

  it("Navod puts the caret after the selection and asks for the citation popover", async () => {
    await mount();
    const asked = vi.fn();
    const off = onCiteOpen(asked);
    await select(1, 10);
    await act(async () => { button(t.cite).click(); });
    off();
    expect(editor!.state.selection.empty).toBe(true);
    expect(editor!.state.selection.from).toBe(10);
    expect(asked).toHaveBeenCalledTimes(1);
  });
});

describe("ED-109 model", () => {
  it("places the bubble above the selection, and under it near the top or on a low screen", () => {
    const rect = { top: 300, bottom: 320, left: 100, right: 200 };
    expect(bubblePlace(rect, { width: 1200, height: 900 })).toEqual({ top: 256, left: 150, below: false });
    expect(bubblePlace({ ...rect, top: 80, bottom: 100 }, { width: 1200, height: 900 })).toMatchObject({ top: 110, below: true });
    expect(bubblePlace(rect, { width: 600, height: 650 })).toMatchObject({ top: 330, below: true });
  });

  it("needs three characters without the spaces around them", () => {
    const place = document.createElement("div");
    const e = new Editor({ element: place, extensions: createEditorExtensionsV3(),
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: " ab  cd" }] }] } });
    e.commands.setTextSelection({ from: 1, to: 5 });
    expect(bubbleText(e.state)).toBeNull();
    e.commands.setTextSelection({ from: 1, to: 8 });
    expect(bubbleText(e.state)).toBe("ab  cd");
    e.destroy();
  });
});
