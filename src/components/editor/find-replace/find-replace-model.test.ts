// @vitest-environment node
import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import { createEditorExtensionsV2 } from "@/editor";

import { findMatches, inSourceQuote, replaceEvery, replaceOne } from "./find-replace-model";

/** WEB-1605 part 2: the host side of find and replace on a real editor. Invented text only. */

const id = (x: string) => ({ nodeId: `${x.repeat(8)}-0000-4000-8000-${x.repeat(12)}` });

function setup() {
  const editor = new Editor({
    element: null,
    extensions: createEditorExtensionsV2(),
    content: {
      type: "doc",
      content: [
        { type: "paragraph", attrs: id("a"), content: [{ type: "text", text: "Rijeka teče. rijeka je mirna." }] },
        { type: "quote", attrs: id("b"), content: [{ type: "text", text: "Rijeka iz izvora." }] },
        { type: "paragraph", attrs: id("c"), content: [{ type: "text", text: "Kraj uz Rijeka." }] },
      ],
    },
  });
  // Without a DOM the view keeps its first plugins; give it the history, as the quotes test does.
  editor.view.updateState(editor.state.reconfigure({ plugins: editor.extensionManager.plugins }));
  const run = (outcome: ReturnType<typeof replaceEvery>) => {
    if (!outcome.ok) throw new Error(outcome.reason);
    editor.view.dispatch(outcome.tr);
    return outcome.count;
  };
  return { editor, run, text: () => editor.state.doc.textBetween(0, editor.state.doc.content.size, "|") };
}

describe("find and replace in the host", () => {
  it("finds in source quotes as well and tells them apart", () => {
    const { editor } = setup();
    const result = findMatches(editor.state.doc, "Rijeka", true)!;
    expect(result.matches).toHaveLength(3);
    expect(result.matches.map((match) => inSourceQuote(result.doc, match))).toEqual([false, true, false]);
  });

  it("matching case is respected", () => {
    const { editor } = setup();
    expect(findMatches(editor.state.doc, "rijeka", false)!.matches).toHaveLength(4);
    expect(findMatches(editor.state.doc, "rijeka", true)!.matches).toHaveLength(1);
  });

  it("replace all leaves source quotes alone and is one step to undo (criterion 2)", () => {
    const { editor, run, text } = setup();
    const before = text();
    const result = findMatches(editor.state.doc, "rijeka", false)!;
    expect(run(replaceEvery(editor.state, result, "Drava"))).toBe(3);
    expect(text()).toBe("Drava teče. Drava je mirna.|Rijeka iz izvora.|Kraj uz Drava.");
    editor.commands.undo();
    expect(text()).toBe(before);
  });

  it("one hit in a source quote is refused, others are replaced", () => {
    const { editor, run, text } = setup();
    const result = findMatches(editor.state.doc, "Rijeka", true)!;
    expect(replaceOne(editor.state, result, 1, "Drava")).toEqual({ ok: false, reason: "in_quote" });
    expect(run(replaceOne(editor.state, result, 2, "Drava"))).toBe(1);
    expect(text()).toBe("Rijeka teče. rijeka je mirna.|Rijeka iz izvora.|Kraj uz Drava.");
  });

  it("a search over a changed text is refused as stale", () => {
    const { editor, run } = setup();
    const result = findMatches(editor.state.doc, "Rijeka", true)!;
    run(replaceOne(editor.state, result, 0, "Drava"));
    expect(replaceEvery(editor.state, result, "Sava")).toEqual({ ok: false, reason: "stale" });
    expect(replaceOne(editor.state, result, 1, "Sava")).toEqual({ ok: false, reason: "stale" });
  });

  it("only hits in source quotes leave nothing to replace", () => {
    const { editor } = setup();
    const result = findMatches(editor.state.doc, "izvora", true)!;
    expect(replaceEvery(editor.state, result, "vrela")).toEqual({ ok: false, reason: "no_match" });
  });
});
