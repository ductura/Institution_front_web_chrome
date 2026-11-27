// @vitest-environment jsdom
// ED-108: "Zalijepljeno. Što je ovo?" after a real paste in the editor. Invented texts only.
import { Editor } from "@tiptap/core";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEditorExtensionsV2 } from "@/editor";
import type { createSourceNote } from "@/client/source-notebook";

import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import { parseStash, storageKey } from "../left/left-model";
import { pasteWhatHr as t } from "./messages.hr";
import { PasteWhat } from "./PasteWhatHost";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom lays nothing out: the editor's focus() scrolls the selection into view a frame later, and without
// these the scroll throws outside the test (CI, an unhandled error after the stash test). As code-host.test.ts.
const rects = () => ({ length: 0, item: () => null, [Symbol.iterator]: function* () {} });
Range.prototype.getClientRects = rects as never;
Range.prototype.getBoundingClientRect = (() => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 })) as never;
Element.prototype.getClientRects = rects as never;

const SOURCE = "00000000-0000-4000-8000-00000000c0a1";
const PASTE = "Kišni vrt zadržava vodu s krova.";
const doc = (sources: unknown[]) => ({
  type: "doc",
  attrs: { sources },
  content: [{ type: "paragraph", attrs: { nodeId: "00000000-0000-4000-8000-000000000001" }, content: [{ type: "text", text: "Uvod. " }] }],
});
const garden = { id: SOURCE, type: "book", title: "Izmišljeni vrt", year: 2026,
  authors: [{ kind: "organization", name: "Izmišljeni institut" }], place: "Izmišljeni grad", publisher: "Izmišljeni nakladnik" };

describe("ED-108 Zalijepljeno. Što je ovo?", () => {
  let root: Root | undefined;
  let editor: Editor | undefined;
  afterEach(() => {
    act(() => root?.unmount()); editor?.destroy(); root = undefined; editor = undefined;
    document.body.innerHTML = ""; localStorage.clear();
  });

  const mount = async (sources: unknown[] = [garden], create?: typeof createSourceNote) => {
    const place = document.createElement("div");
    document.body.append(place);
    editor = new Editor({ element: place, extensions: createEditorExtensionsV2(), content: doc(sources) });
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root?.render(h(PasteWhat, { editor: editor!, documentId: "d", workId: "rad-1", create })); });
  };
  const paste = async (text: string) => {
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: { getData: (type: string) => (type === "text/plain" ? text : ""), types: ["text/plain"], files: [] } });
    await act(async () => { editor!.view.dom.dispatchEvent(event); await new Promise((r) => setTimeout(r, 0)); });
  };
  const button = (start: string) => [...document.querySelectorAll("button")].find((b) => b.textContent?.startsWith(start)) as HTMLButtonElement | undefined;
  const click = async (start: string) => { await act(async () => { button(start)!.click(); await new Promise((r) => setTimeout(r, 0)); }); };
  const text = () => editor!.state.doc.textContent;

  it("asks after a paste of a few words, not after one or two", async () => {
    await mount();
    await paste("dvije riječi");
    expect(document.querySelector("[data-paste-what]")).toBeNull();
    await paste(PASTE);
    expect(document.body.textContent).toContain(t.title);
    for (const label of [t.quote, t.note, t.stash, t.keep]) expect(button(label)).toBeDefined();
  });

  it("puts a literal quote in Croatian quotes with the cursor after it", async () => {
    await mount();
    await paste(PASTE);
    await click(t.quote);
    expect(text()).toBe(`Uvod. „${PASTE}”`);
    expect(editor!.state.selection.from).toBe(editor!.state.doc.content.size - 1);
    expect(document.body.textContent).toContain(t.quoted);
  });

  it("sets the paste aside in the left panel's stash and takes it out of the text", async () => {
    await mount();
    await paste(PASTE);
    await click(t.stash);
    expect(text()).toBe("Uvod. ");
    const items = parseStash(JSON.parse(localStorage.getItem(storageKey("stash", "rad-1")) ?? "[]"));
    expect(items.map((i) => i.text)).toEqual([PASTE]);
    expect(document.body.textContent).toContain(t.stashed);
  });

  it("saves the paste as a note to the chosen source and takes it out of the work", async () => {
    const create = vi.fn(async () => ({ kind: "ok" as const, note: {} as never }));
    await mount([garden], create as unknown as typeof createSourceNote);
    await paste(PASTE);
    await click(t.note);
    expect(document.body.textContent).toContain(t.whichSource);
    await click("Izmišljeni institut");
    expect(create).toHaveBeenCalledWith("d", SOURCE, { quote: PASTE });
    expect(text()).toBe("Uvod. ");
    expect(document.body.textContent).toContain(t.noted);
  });

  it("keeps the text when the note fails, and asks for a source first when there is none", async () => {
    const create = vi.fn(async () => ({ kind: "unavailable" as const }));
    await mount([garden], create as unknown as typeof createSourceNote);
    await paste(PASTE);
    await click(t.note);
    await click("Izmišljeni institut");
    expect(text()).toBe(`Uvod. ${PASTE}`);
    expect(document.body.textContent).toContain(t.failed);
    act(() => root?.unmount()); editor?.destroy(); root = undefined; document.body.innerHTML = "";
    await mount([]);
    await paste(PASTE);
    await click(t.note);
    expect(document.body.textContent).toContain(t.noSources);
  });

  it("leaves the text as it is, and lapses when the text changes", async () => {
    await mount();
    await paste(PASTE);
    await click(t.keep);
    expect(text()).toBe(`Uvod. ${PASTE}`);
    expect(document.querySelector("[data-paste-what]")).toBeNull();
    await paste(PASTE);
    act(() => { editor!.commands.insertContent("x"); });
    expect(document.querySelector("[data-paste-what]")).toBeNull();
  });

  it("has no forbidden terms in its texts", () => {
    expect(findForbiddenTerms(Object.values(t).join("\n"), "hr")).toEqual([]);
  });
});
