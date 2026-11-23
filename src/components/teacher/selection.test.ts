// @vitest-environment jsdom
// INT-26: the offsets of a selection in the live text count the block's text
// only. The label of a v3 atom (`data-atom`) is never counted, and a v1 block
// (no atoms) gives exactly the offsets of its whole text as before. Invented text.
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { selectedRange, selectInBlock } from "./selection";

const ID = "6f708192-a3b4-4cde-8f01-5c6d7e8f9a0b";

function mount(inner: string): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = `<p data-node-id="${ID}">${inner}</p>`;
  document.body.append(root);
  return root;
}

/** Selects from (`a`, `aAt`) to (`b`, `bAt`) and returns the selection. */
function select(a: Node, aAt: number, b: Node, bAt: number): Selection {
  const range = document.createRange();
  range.setStart(a, aAt);
  range.setEnd(b, bAt);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  return selection;
}

const textOf = (root: HTMLElement, n: number) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  for (let i = 0; i < n; i += 1) node = walker.nextNode();
  return node!;
};

// jsdom draws nothing, so it has no scrolling.
beforeEach(() => { Element.prototype.scrollIntoView = () => {}; });
afterEach(() => { document.body.innerHTML = ""; });

describe("selectedRange (INT-26)", () => {
  it("counts a v1 block's whole text, as before", () => {
    const root = mount("<span>Kompost </span><mark>smanjuje</mark><span> otpad.</span>");
    const selection = select(textOf(root, 1), 2, textOf(root, 2), 3);
    expect(selectedRange(root, selection)).toEqual({ nodeId: ID, start: 10, end: 19 });
    expect(selectedRange(root, select(root.firstChild!, 0, root.firstChild!, 3))).toEqual({ nodeId: ID, start: 0, end: 23 });
    // The same offsets the earlier count (the text of the range up to each end) gave, for every pair of ends.
    const block = root.firstChild as HTMLElement;
    const ends: [Node, number][] = [[block, 0], [block, 1], [block, 2], [block, 3]];
    for (let i = 0; i < 3; i += 1) for (let at = 0; at <= textOf(root, i).textContent!.length; at += 1) ends.push([textOf(root, i), at]);
    const earlier = (node: Node, at: number) => {
      const before = document.createRange();
      before.selectNodeContents(block);
      before.setEnd(node, at);
      return before.toString().length;
    };
    for (const [a, aAt] of ends) for (const [b, bAt] of ends) {
      if (earlier(a, aAt) >= earlier(b, bAt)) continue;
      expect(selectedRange(root, select(a, aAt, b, bAt))).toEqual({ nodeId: ID, start: earlier(a, aAt), end: earlier(b, bAt) });
    }
  });

  it("skips the label of an atom on both sides of the selection", () => {
    const root = mount('<span>Kompost smanjuje otpad.</span><span data-atom="footnote"> [fusnota: Izmišljeno.]</span><span> Vidi</span>');
    // From "otpad." to " Vi": the footnote's label lies between and is not counted.
    const selection = select(textOf(root, 0), 17, textOf(root, 2), 3);
    expect(selectedRange(root, selection)).toEqual({ nodeId: ID, start: 17, end: 26 });
  });

  it("selects back the same characters, never inside a label", () => {
    const root = mount('<span>Kompost smanjuje otpad.</span><span data-atom="footnote"> [fusnota: Izmišljeno.]</span><span> Vidi</span>');
    expect(selectInBlock(root, ID, 17, 26)).toBe(true);
    expect(window.getSelection()!.toString()).toBe("otpad. [fusnota: Izmišljeno.] Vi");
    const range = window.getSelection()!.getRangeAt(0);
    expect(range.startContainer).toBe(textOf(root, 0));
    expect(range.endContainer).toBe(textOf(root, 2));
    expect(selectedRange(root, window.getSelection())).toEqual({ nodeId: ID, start: 17, end: 26 });
  });
});
