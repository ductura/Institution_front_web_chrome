/**
 * One item of a numbered list (WEB-1608, M5.V1, V11 of D-201): a flat text
 * block of the same level as a paragraph and a bullet item, never a wrapper
 * (the canonical model and the replayer assume blocks of depth 1). The nesting
 * is the `level` attribute, 1 to 3; the number is derived from the order
 * (`numbering.ts`) and drawn by a decoration, never stored.
 *
 * Keys: Mod-Shift-7 turns the block into an item and back; "1. " or "1) " at
 * the start of a block makes it an item. Tab makes the item one level deeper
 * (at most 3), Shift-Tab one level shallower; on level 1, Shift-Tab leaves
 * the key alone. Enter at the end of an item opens the next item on the same
 * level; Enter on an empty item or Backspace at the start of an item gives a
 * paragraph back (an empty item on a deeper level first goes one level up).
 */

import { InputRule, mergeAttributes, Node, type Editor } from "@tiptap/core";
import type { Node as PmNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

import { markerRemoval, markerToBlock } from "../editor/text-block";
import { MAX_LIST_LEVEL, numberedListNumbers, type ListLevel } from "./numbering";

export const NUMBERED_ITEM = "numberedItem";

const markerKey = new PluginKey<null>("numberedItemMarker");
const numbersKey = new PluginKey<DecorationSet>("numberedItemNumbers");

/** "1. " or "1) " typed at the start of a block (any number, as in Word). */
export const NUMBERED_MARKER = /^\s*(\d{1,3})[.)]\s$/;

const clampLevel = (value: unknown): ListLevel =>
  Math.min(MAX_LIST_LEVEL, Math.max(1, Math.trunc(Number(value) || 1))) as ListLevel;

export const NumberedItem = Node.create({
  name: NUMBERED_ITEM,
  group: "block",
  content: "inline*",

  addAttributes() {
    return {
      level: {
        default: 1,
        parseHTML: (element) => clampLevel(element.getAttribute("data-level")),
        renderHTML: (attrs) => ({ "data-level": String(clampLevel(attrs.level)) }),
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'p[data-block="numbered-item"]', priority: 60 },
      // An item of `ol` is read through its paragraph, as for the bullet item.
      { tag: "ol > li", getAttrs: (element) => (element.querySelector(":scope > p") ? false : null) },
      { tag: "ol > li > p", priority: 60 },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["p", mergeAttributes(HTMLAttributes, { "data-block": "numbered-item" }), 0];
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-7": () => this.editor.commands.toggleNode(this.name, "paragraph"),
      Tab: () => numberedItemIndent(this.editor, 1),
      "Shift-Tab": () => numberedItemIndent(this.editor, -1),
      Enter: () => numberedItemEnter(this.editor),
      Backspace: () => numberedItemBackspace(this.editor),
    };
  },

  addProseMirrorPlugins() {
    return [markerRemoval(markerKey), numbersPlugin()];
  },

  addInputRules() {
    return [
      new InputRule({
        find: NUMBERED_MARKER,
        handler: ({ state, range }) => (markerToNumberedItem(state.tr, range.from, range.to, this.type) ? undefined : null),
      }),
    ];
  },
});

/** The input rule's change for "1. " (`markerToBlock`). */
export function markerToNumberedItem(tr: Transaction, from: number, to: number, item: Parameters<typeof markerToBlock>[3]): boolean {
  return markerToBlock(tr, from, to, item, markerKey);
}

/**
 * Tab / Shift-Tab in a numbered item: `delta` levels deeper (+1) or shallower
 * (-1). False (key left alone) outside an item or at the end of the range, so
 * Shift-Tab on level 1 and Tab on level 3 do nothing and focus stays put.
 */
export function numberedItemIndent(editor: Editor, delta: 1 | -1): boolean {
  const { $from } = editor.state.selection;
  if ($from.parent.type.name !== NUMBERED_ITEM) return false;
  const level = clampLevel($from.parent.attrs.level);
  const next = level + delta;
  // The key is ours inside an item even when the level cannot change:
  // Tab must not move focus out of the text.
  if (next < 1 || next > MAX_LIST_LEVEL) return delta === 1;
  return editor.commands.updateAttributes(NUMBERED_ITEM, { level: next });
}

/** Enter in an item: the next item on the same level; on an empty one go up, then paragraph. */
export function numberedItemEnter(editor: Editor): boolean {
  const { state } = editor;
  const { $from, empty } = state.selection;
  const item = state.schema.nodes[NUMBERED_ITEM];
  if (!empty || !item || $from.parent.type !== item) return false;
  const level = clampLevel($from.parent.attrs.level);
  if ($from.parent.content.size === 0) {
    return level > 1
      ? editor.commands.updateAttributes(NUMBERED_ITEM, { level: level - 1 })
      : editor.commands.setNode("paragraph");
  }
  if ($from.parentOffset < $from.parent.content.size) return false;
  const marks = state.storedMarks ?? $from.marks();
  return editor.commands.command(({ tr, dispatch }) => {
    // The new item has no id: the identity plugin gives it its own.
    if (dispatch) tr.split($from.pos, 1, [{ type: item, attrs: { level } }]).ensureMarks(marks).scrollIntoView();
    return true;
  });
}

/** Backspace at the start of an item: a paragraph with the same text. */
export function numberedItemBackspace(editor: Editor): boolean {
  const { $from, empty } = editor.state.selection;
  if (!empty || $from.parent.type.name !== NUMBERED_ITEM || $from.parentOffset !== 0) return false;
  return editor.commands.setNode("paragraph");
}

const STYLE_ID = "ductura-numbered-item-style";
/** Left indent per level and the number before the text; also printed (the number is in `data-number`). */
const NUMBER_STYLE = `
.ProseMirror p.numbered-item { position: relative; padding-left: calc(2.25em + (var(--list-level, 1) - 1) * 1.5em); margin: 0.15em 0; }
.ProseMirror p.numbered-item::before { content: attr(data-number); position: absolute; left: calc((var(--list-level, 1) - 1) * 1.5em); width: 2.25em; text-align: right; padding-right: 0.5em; box-sizing: border-box; font-variant-numeric: tabular-nums; }
.ProseMirror p.numbered-item[data-level="2"] { --list-level: 2; }
.ProseMirror p.numbered-item[data-level="3"] { --list-level: 3; }
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
  const blocks: { type: string; level?: number; pos: number }[] = [];
  doc.forEach((node, offset) => blocks.push({ type: node.type.name, level: node.attrs.level as number | undefined, pos: offset }));
  const labels = numberedListNumbers(blocks);
  return blocks.flatMap((block, i) => (labels[i] === null ? [] : [{ pos: block.pos, label: labels[i]! }]));
}

function numbersPlugin(): Plugin<DecorationSet> {
  const build = (doc: PmNode): DecorationSet =>
    DecorationSet.create(
      doc,
      numberLabels(doc).map(({ pos, label }) =>
        Decoration.node(pos, pos + doc.nodeAt(pos)!.nodeSize, { "data-number": label, class: "numbered-item" }),
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
