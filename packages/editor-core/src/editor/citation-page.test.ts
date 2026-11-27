// @vitest-environment node
import { Editor } from "@tiptap/core";
import type { EditorView } from "@tiptap/pm/view";
import { afterEach, describe, expect, it } from "vitest";

import { createEditorExtensionsV2 } from "./schema";

/** ED-105: ":31" typed right after a citation becomes its page. Invented ids and filler text only. */
const ID_A = "aaaaaaaa-0000-4000-8000-00000000000a";
const SRC_1 = "11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

let editor: Editor | null = null;
afterEach(() => { editor?.destroy(); editor = null; });

/** "Ab" (1–3), citation (3–4), then `after`. */
function setUp(after: string): Editor {
  editor = new Editor({ element: null, extensions: createEditorExtensionsV2(), content: { type: "doc", content: [{
    type: "paragraph", attrs: { nodeId: ID_A }, content: [
      { type: "text", text: "Ab" },
      { type: "citation", attrs: { sourceId: SRC_1, locator: null } },
      ...(after ? [{ type: "text", text: after }] : []),
    ] }] } });
  editor.view.updateState(editor.state.reconfigure({ plugins: editor.extensionManager.plugins }));
  return editor;
}

/** One typed character at the end of the paragraph, as the view asks every handleTextInput. */
function type(e: Editor, char: string): boolean {
  const at = e.state.doc.firstChild!.nodeSize - 1;
  return e.state.plugins.some((plugin) => {
    const handle = plugin.props.handleTextInput as ((view: EditorView, from: number, to: number, text: string) => boolean) | undefined;
    return handle?.call(plugin, e.view, at, at, char) ?? false;
  });
}

const parts = (e: Editor) => {
  const out: string[] = [];
  e.state.doc.firstChild!.forEach((c) => out.push(c.isText ? c.text! : `[${c.attrs.locator ?? ""}]`));
  return out;
};

describe("page typed after a citation", () => {
  it("puts :31 in the citation when a space follows", () => {
    const e = setUp(" :31");
    expect(type(e, " ")).toBe(true);
    expect(parts(e)).toEqual(["Ab", "[31]", " "]);
  });

  it("takes a range and a full stop right after the citation, with an en dash", () => {
    const e = setUp(":31-35");
    expect(type(e, ".")).toBe(true);
    expect(parts(e)).toEqual(["Ab", "[31–35]", "."]);
  });

  it("leaves other text alone", () => {
    for (const after of [" str. 31", " :", "x:31", "  :31"]) {
      const e = setUp(after);
      expect(type(e, " ")).toBe(false);
      e.destroy();
    }
  });

  it("waits for a space or punctuation", () => {
    expect(type(setUp(" :31"), "2")).toBe(false);
  });
});
