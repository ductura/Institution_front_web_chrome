// @vitest-environment jsdom
// ED-76: "Prepoznat izvor" after a real paste in the editor. Invented texts only.
import { Editor } from "@tiptap/core";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEditorExtensionsV2, tiptapToCanonicalV2 } from "@/editor";
import type { readSourceNotes } from "@/client/source-notebook";

import { pasteSourceHr as t } from "./messages.hr";
import { PasteSource } from "./PasteSourceHost";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SOURCE = "00000000-0000-4000-8000-00000000c0a1";
const QUOTE = "Kišni vrt zadržava vodu s krova i polako je vraća u tlo kroz slojeve pijeska.";
const doc = {
  type: "doc",
  attrs: { sources: [{ id: SOURCE, type: "book", title: "Izmišljeni vrt", year: 2026,
    authors: [{ kind: "organization", name: "Izmišljeni institut" }], place: "Izmišljeni grad", publisher: "Izmišljeni nakladnik" }] },
  content: [{ type: "paragraph", attrs: { nodeId: "00000000-0000-4000-8000-000000000001" }, content: [{ type: "text", text: "Uvod. " }] }],
};

describe("ED-76 Prepoznat izvor", () => {
  let root: Root | undefined;
  let editor: Editor | undefined;
  afterEach(() => { act(() => root?.unmount()); editor?.destroy(); root = undefined; editor = undefined; document.body.innerHTML = ""; });

  const mount = async (notes: { quote: string | null; page: string | null }[], editable = true) => {
    const place = document.createElement("div");
    document.body.append(place);
    editor = new Editor({ element: place, extensions: createEditorExtensionsV2(), content: doc, editable });
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    const read = vi.fn(async () => ({ kind: "ready" as const, notes: notes.map((n, i) => ({ id: `00000000-0000-4000-8000-00000000b00${i}`, note: null, ...n })) }));
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root?.render(h(PasteSource, { editor: editor!, documentId: "d", read: read as unknown as typeof readSourceNotes })); });
    return { host, read };
  };
  const paste = async (text: string) => {
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: { getData: (type: string) => (type === "text/plain" ? text : ""), types: ["text/plain"], files: [] } });
    await act(async () => { editor!.view.dom.dispatchEvent(event); await new Promise((r) => setTimeout(r, 0)); });
  };
  const button = (label: string) => [...document.querySelectorAll("button")].find((b) => b.textContent === label) as HTMLButtonElement | undefined;
  const children = () => {
    const result = tiptapToCanonicalV2(editor!.getJSON());
    return result.ok ? result.doc.nodes[0]!.children : [];
  };

  it("offers the citation with the note's page and puts it right after the pasted text", async () => {
    const { host, read } = await mount([{ quote: QUOTE, page: "12" }]);
    await paste(`Kao što piše, ${QUOTE}`);
    expect(read).toHaveBeenCalledWith("d", SOURCE, expect.anything());
    expect(host.textContent).toContain(`${t.found} ${t.source("Izmišljeni institut (2026)", "12")}`);
    expect(editor!.getText()).toContain(QUOTE);

    await act(async () => { button(t.add)!.click(); });
    const parts = children();
    expect(parts.map((c: { type: string }) => c.type)).toEqual(["text", "citation", "text"]);
    expect(parts[1]).toEqual({ type: "citation", sourceId: SOURCE, locator: "12" });
    expect(host.textContent).toContain(t.added);
  });

  it("lets go of the offer once the text changes, and on Zatvori", async () => {
    const { host } = await mount([{ quote: QUOTE, page: "12" }]);
    await paste(QUOTE);
    expect(button(t.add)).toBeDefined();
    await act(async () => { editor!.commands.insertContent("x"); });
    expect(button(t.add)).toBeUndefined();
    await paste(QUOTE);
    await act(async () => { button(t.close)!.click(); });
    expect(host.textContent).toBe("");
    expect(children().some((c: { type: string }) => c.type === "citation")).toBe(false);
  });

  it("stays quiet for a short paste, an unknown passage, and a read-only editor", async () => {
    const { host, read } = await mount([{ quote: QUOTE, page: "12" }]);
    await paste("Kišni vrt zadržava vodu.");
    expect(read).not.toHaveBeenCalled();
    await paste("Rijeka nosi mulj prema moru svake jeseni, a obala se polako mijenja.");
    expect(read).toHaveBeenCalled();
    expect(host.textContent).toBe("");
    act(() => root?.unmount()); editor?.destroy(); document.body.innerHTML = "";
    const quiet = await mount([{ quote: QUOTE, page: "12" }], false);
    await paste(QUOTE);
    expect(quiet.read).not.toHaveBeenCalled();
  });
});
