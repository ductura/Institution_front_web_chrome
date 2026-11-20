import { Editor } from "@tiptap/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createEditorExtensions, replaceAllTransaction } from "@/editor";
import { readFindScope, saveFindScope, searchWork } from "./find";

let editor: Editor | undefined;
afterEach(() => {
  editor?.destroy();
  vi.unstubAllGlobals();
});

function example() {
  editor = new Editor({ element: null, extensions: createEditorExtensions(), content: {
    type: "doc", content: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Uvod" }] },
      { type: "paragraph", content: [{ type: "text", text: "Maslina i „maslina”." }] },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Pokus" }] },
      { type: "quote", content: [{ type: "text", text: "Maslina" }] },
    ],
  } });
  return editor;
}

describe("editor search", () => {
  it("stores only the scope and still works if the browser blocks storage", () => {
    let value: string | null = null;
    vi.stubGlobal("localStorage", {
      getItem: () => value,
      setItem: (_key: string, scope: string) => { value = scope; },
    });
    saveFindScope("quote");
    expect(readFindScope()).toBe("quote");
    vi.stubGlobal("localStorage", undefined);
    expect(readFindScope()).toBe("all");
    expect(() => saveFindScope("chapter")).not.toThrow();
  });

  it("maps chapter matches back to the original document", () => {
    const { doc } = example().state;
    const all = searchWork(doc, "maslina", "all", 1);
    expect(all?.matches).toHaveLength(3);
    expect(searchWork(doc, "maslina", "chapter", 1)?.matches).toEqual(all?.matches.slice(0, 2));
    expect(searchWork(doc, "maslina", "chapter", doc.content.size - 1)?.matches).toEqual(all?.matches.slice(2));
  });

  it("replaces only quoted matches in the same transaction", () => {
    const { state } = example();
    const result = searchWork(state.doc, "maslina", "quote", 1);
    const changed = replaceAllTransaction(state, result!, "smokva");
    expect(changed.ok && changed.count).toBe(2);
    if (changed.ok) expect(changed.tr.doc.textBetween(0, changed.tr.doc.content.size, "|")).toBe(
      "Uvod|Maslina i „smokva”.|Pokus|smokva",
    );
  });
});
