/**
 * One item of a numbered list (contract v4 §2.2, SRV#754): a flat text block
 * of the same level as a paragraph and a bullet item, never a wrapper, with
 * no attribute but its id and no nesting (an item holds no block, a list in a
 * list does not exist). The number is its position in a run of consecutive
 * items (`numbering.ts`), drawn by a decoration, never stored.
 *
 * Keys: Mod-Shift-7 turns the block into an item and back; "1. " or "1) " at
 * the start of a block makes it an item. Enter at the end of an item opens
 * the next item; Enter on an empty item or Backspace at the start of an item
 * gives a paragraph back. Tab and Shift-Tab are left alone.
 */

import { InputRule, mergeAttributes, Node, type Editor } from "@tiptap/core";
import type { Node as PmNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

import { markerRemoval, markerToBlock } from "../editor/text-block";
import { orderedListNumbers } from "./numbering";

export const ORDERED_ITEM = "orderedItem";

const markerKey = new PluginKey<null>("orderedItemMarker");
const numbersKey = new PluginKey<DecorationSet>("orderedItemNumbers");

/** "1. " or "1) " typed at the start of a block (any number, as in Word). */
export const ORDERED_MARKER = /^\s*(\d{1,3})[.)]\s$/;

export const OrderedItem = Node.create({
  name: ORDERED_ITEM,
  group: "block",
  content: "inline*",

  parseHTML() {
    return [
      { tag: 'p[data-block="ordered-item"]', priority: 60 },
      // An item of `ol` is read through its paragraph, as for the bullet item.
      { tag: "ol > li", getAttrs: (element) => (element.querySelector(":scope > p") ? false : null) },
      { tag: "ol > li > p", priority: 60 },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["p", mergeAttributes(HTMLAttributes, { "data-block": "ordered-item" }), 0];
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-7": () => this.editor.commands.toggleNode(this.name, "paragraph"),
      Enter: () => orderedItemEnter(this.editor),
      Backspace: () => orderedItemBackspace(this.editor),
    };
  },

  addProseMirrorPlugins() {
    return [markerRemoval(markerKey), numbersPlugin()];
  },

  addInputRules() {
    return [
      new InputRule({
        find: ORDERED_MARKER,
        handler: ({ state, range }) => (markerToOrderedItem(state.tr, range.from, range.to, this.type) ? undefined : null),
      }),
    ];
  },
});

/** The input rule's change for "1. " (`markerToBlock`). */
export function markerToOrderedItem(tr: Transaction, from: number, to: number, item: Parameters<typeof markerToBlock>[3]): boolean {
  return markerToBlock(tr, from, to, item, markerKey);
}

/** Enter in an item: the next item; on an empty one a paragraph. */
export function orderedItemEnter(editor: Editor): boolean {
  const { state } = editor;
  const { $from, empty } = state.selection;
  const item = state.schema.nodes[ORDERED_ITEM];
  if (!empty || !item || $from.parent.type !== item) return false;
  if ($from.parent.content.size === 0) return editor.commands.setNode("paragraph");
  if ($from.parentOffset < $from.parent.content.size) return false;
  const marks = state.storedMarks ?? $from.marks();
  return editor.commands.command(({ tr, dispatch }) => {
    // The new item has no id: the identity plugin gives it its own.
    if (dispatch) tr.split($from.pos, 1, [{ type: item }]).ensureMarks(marks).scrollIntoView();
    return true;
  });
}

/** Backspace at the start of an item: a paragraph with the same text. */
export function orderedItemBackspace(editor: Editor): boolean {
  const { $from, empty } = editor.state.selection;
  if (!empty || $from.parent.type.name !== ORDERED_ITEM || $from.parentOffset !== 0) return false;
  return editor.commands.setNode("paragraph");
}

const STYLE_ID = "ductura-ordered-item-style";
/** Left indent and the number before the text; also printed (the number is in `data-number`). */
const NUMBER_STYLE = `
.ProseMirror p.ordered-item { position: relative; padding-left: 2.25em; margin: 0.15em 0; }
.ProseMirror p.ordered-item::before { content: attr(data-number); position: absolute; left: 0; width: 2.25em; text-align: right; padding-right: 0.5em; box-sizing: border-box; font-variant-numeric: tabular-nums; }
`;
function installNumberStyle(): void {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = NUMBER_STYLE;
  document.head.appendChild(style);
}

/** The numbers of a document's top-level blocks, by position. */
export function numberLabels(doc: PmNode): { pos: number; label: string }[] {
  const blocks: { type: string; pos: number }[] = [];
  doc.forEach((node, offset) => blocks.push({ type: node.type.name, pos: offset }));
  const labels = orderedListNumbers(blocks);
  return blocks.flatMap((block, i) => (labels[i] === null ? [] : [{ pos: block.pos, label: labels[i]! }]));
}

function numbersPlugin(): Plugin<DecorationSet> {
  const build = (doc: PmNode): DecorationSet =>
    DecorationSet.create(
      doc,
      numberLabels(doc).map(({ pos, label }) =>
        Decoration.node(pos, pos + doc.nodeAt(pos)!.nodeSize, { "data-number": label, class: "ordered-item" }),
      ),
    );
  return new Plugin<DecorationSet>({
    key: numbersKey,
    state: { init: (_config, state) => build(state.doc), apply: (tr, old) => (tr.docChanged ? build(tr.doc) : old) },
    props: { decorations: (state) => numbersKey.getState(state) },
    view: () => {
      installNumberStyle();
      return {};
    },
  });
}
