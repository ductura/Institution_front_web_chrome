// @vitest-environment node
import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import { createEditorExtensionsV2 } from "@/editor";

import { chapterRange, inScope } from "./find-scope";

const id = (x: string) => ({ nodeId: `${x.repeat(8)}-0000-4000-8000-${x.repeat(12)}` });
const text = (s: string) => [{ type: "text", text: s }];

function doc() {
  return new Editor({
    element: null,
    extensions: createEditorExtensionsV2(),
    content: { type: "doc", content: [
      { type: "paragraph", attrs: id("a"), content: text("Uvod prije naslova.") },
      { type: "heading", attrs: { ...id("b"), level: 2 }, content: text("Prvo poglavlje") },
      { type: "paragraph", attrs: id("c"), content: text("Tekst prvog.") },
      { type: "heading", attrs: { ...id("d"), level: 3 }, content: text("Potpoglavlje") },
      { type: "paragraph", attrs: id("e"), content: text("Još prvog.") },
      { type: "heading", attrs: { ...id("f"), level: 2 }, content: text("Drugo poglavlje") },
      { type: "paragraph", attrs: id("g"), content: text("Tekst drugog.") },
    ] },
  }).state.doc;
}

describe("chapterRange", () => {
  it("runs from the level 1-2 heading before the position to the next one", () => {
    const d = doc();
    const second = d.child(0).nodeSize + d.child(1).nodeSize + d.child(2).nodeSize; // start of the level 3 heading
    const range = chapterRange(d, second + 2);
    expect(range.from).toBe(d.child(0).nodeSize);
    expect(range.to).toBe(second + d.child(3).nodeSize + d.child(4).nodeSize);
  });
  it("starts at the beginning before the first heading and ends at the end in the last chapter", () => {
    const d = doc();
    expect(chapterRange(d, 2).from).toBe(0);
    expect(chapterRange(d, d.content.size - 2).to).toBe(d.content.size);
  });
});

describe("inScope", () => {
  const ms = [{ from: 1, to: 3 }, { from: 10, to: 12 }];
  it("keeps all, the chapter's, or the quotes' matches", () => {
    expect(inScope(ms, "all", { from: 0, to: 5 }, () => false)).toHaveLength(2);
    expect(inScope(ms, "chap", { from: 0, to: 5 }, () => false)).toEqual([ms[0]]);
    expect(inScope(ms, "quote", { from: 0, to: 5 }, (m) => m.from === 10)).toEqual([ms[1]]);
  });
});
