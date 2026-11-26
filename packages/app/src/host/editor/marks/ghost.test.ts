// ED-45 (P2-17, dio 3): the ghost text of an empty paragraph says what the chapter around it holds,
// stands only where the cursor is alone in an empty paragraph of a text that can be written, and
// never changes the document. Invented titles only.
import { describe, expect, it } from "vitest";
import { Schema } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import type { DecorationSet } from "@tiptap/pm/view";

import { ghostAt, ghostPlugin, ghostText } from "./ghost";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { content: "inline*", group: "block" },
    heading: { content: "inline*", group: "block", attrs: { level: { default: 2 } } },
    blockquote: { content: "paragraph+", group: "block" },
    text: { group: "inline" },
  },
});
const p = (text = "") => schema.node("paragraph", null, text ? [schema.text(text)] : []);
const hd = (title: string, level = 2) => schema.node("heading", { level }, [schema.text(title)]);
const doc = schema.node("doc", null, [
  p(), // 0..2: before any chapter
  hd("Uvod"), p(), // heading 2..8, empty paragraph 8..10
  hd("Javne politike u gradu"), p("Tekst."), p(), // heading 10..34, text 34..42, empty 42..44
  hd("Podnaslov", 3), p(), // under the same chapter
  schema.node("blockquote", null, [p()]),
]);
const at = (pos: number, to = pos) => EditorState.create({ doc, selection: TextSelection.create(doc, pos, to) });
const posOf = (match: (title: string) => boolean) => { let found = -1; doc.forEach((n, o) => { if (found < 0 && n.type.name === "heading" && match(n.textContent)) found = o; }); return found; };

describe("ghost text (ED-45)", () => {
  it("says what the chapter usually holds, by its title", () => {
    expect(ghostText("")).toContain("Počnite pisati");
    expect(ghostText("1. Uvod")).toMatch(/^Uvod: predmet i problem rada/);
    expect(ghostText("Zaključak i preporuke")).toMatch(/^Zaključak:/);
    expect(ghostText("Javne politike u gradu")).toContain("„Javne politike u gradu”");
    expect(ghostText("Javne politike u gradu")).not.toContain("·");
  });

  it("stands in an empty top-level paragraph, under the chapter (level 1 or 2) before it", () => {
    expect(ghostAt(at(1), true)?.text).toContain("Počnite pisati");
    const intro = posOf((t) => t === "Uvod");
    const after = intro + doc.nodeAt(intro)!.nodeSize;
    expect(ghostAt(at(after + 1), true)).toEqual({ pos: after, size: 2, text: ghostText("Uvod") });
    const sub = posOf((t) => t === "Podnaslov");
    expect(ghostAt(at(sub + doc.nodeAt(sub)!.nodeSize + 1), true)?.text).toBe(ghostText("Javne politike u gradu"));
  });

  it("is absent where there is text, a selection, a nested paragraph or a text that cannot be written", () => {
    const chapter = posOf((t) => t.startsWith("Javne"));
    const text = chapter + doc.nodeAt(chapter)!.nodeSize;
    expect(ghostAt(at(text + 2), true)).toBeNull();
    expect(ghostAt(at(text + 1, text + 3), true)).toBeNull();
    expect(ghostAt(at(doc.content.size - 2), true)).toBeNull();
    expect(ghostAt(at(1), false)).toBeNull();
  });

  it("is a decoration only: the document stays as it was", () => {
    const state = at(1);
    const plugin = ghostPlugin(() => true, "ghost");
    const set = plugin.props.decorations!.call(plugin, state) as DecorationSet | null;
    expect(set?.find().map((d) => [d.from, d.to])).toEqual([[0, 2]]);
    expect(state.doc.eq(doc)).toBe(true);
    const off = ghostPlugin(() => false, "ghost");
    expect(off.props.decorations!.call(off, state)).toBeNull();
  });
});
