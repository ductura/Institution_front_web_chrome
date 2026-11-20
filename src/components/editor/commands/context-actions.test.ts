import { Editor } from "@tiptap/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createEditorExtensions } from "@/editor";
import { contextActions } from "./context-actions";

let editor: Editor | undefined;
afterEach(() => { editor?.destroy(); });

function entries(selected: boolean) {
  editor = new Editor({ element: null, extensions: createEditorExtensions(), content: {
    type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Izmišljeni pokus" }] }],
  } });
  if (selected) editor.commands.setTextSelection({ from: 1, to: 10 });
  const openMenu = vi.fn();
  return { openMenu, items: contextActions(editor, vi.fn(), openMenu).flatMap((entry) => entry.kind === "item" ? [entry] : []) };
}

describe("text context actions", () => {
  it("shows formatting and copy options for the selected text, with unavailable actions disabled", () => {
    const { items } = entries(true);
    expect(items.find(({ id }) => id === "bold")?.disabled).toBe(false);
    expect(items.find(({ id }) => id === "copy")?.disabled).toBe(false);
    expect(items.find(({ id }) => id === "exponent")?.disabled).toBe(true);
    expect(items.some(({ id }) => id === "paste")).toBe(false);
  });

  it("opens the existing insertion tools at the caret", () => {
    const { items, openMenu } = entries(false);
    expect(items.find(({ id }) => id === "paste")?.disabled).toBe(false);
    items.find(({ id }) => id === "chars")?.run?.();
    expect(openMenu).toHaveBeenCalledWith("chars");
  });
});
