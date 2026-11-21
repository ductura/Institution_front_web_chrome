/**
 * The table of contents over the document the editor holds (WEB-1602, M5.3).
 *
 * Numbers come from `numberedHeadings`, which reads the one chapter
 * projection (`deriveChapters`); this file adds no numbering of its own. It
 * gives the host a live table of contents (`createTocStore`), a jump that looks
 * the heading up by block id when it is followed (`goToHeading`) and the
 * chapter move as an editor transaction and keyboard shortcut.
 */

import { Extension, type Editor } from "@tiptap/core";
import { Fragment, type Node as PmNode } from "@tiptap/pm/model";
import { TextSelection, type EditorState } from "@tiptap/pm/state";

import { blockPosition, numberedHeadings } from "../editor/chapter-numbers";
import { currentHeading } from "../editor/outline";

import { planChapterMove, type MoveDirection, type PlanHeading } from "./move";

/** A line of the live table of contents. */
export type EditorTocEntry = {
  /** The block id, or `heading-<n>` for a heading whose id is not minted yet. */
  readonly key: string;
  readonly id: string | null;
  readonly level: number;
  readonly number: string;
  readonly title: string;
};

export type TocSnapshot = {
  readonly entries: readonly EditorTocEntry[];
  /** The key of the heading whose chapter holds the cursor, or null. */
  readonly currentKey: string | null;
  /** Whether the chapter holding the cursor can move up / down now. */
  readonly canMoveUp: boolean;
  readonly canMoveDown: boolean;
  readonly editable: boolean;
};

export const EMPTY_TOC: TocSnapshot = { entries: [], currentKey: null, canMoveUp: false, canMoveDown: false, editable: false };

type Read = { entries: EditorTocEntry[]; positions: number[]; plan: PlanHeading[]; blockCount: number; current: number };

function read(state: EditorState): Read {
  const { doc } = state;
  const headings = numberedHeadings(doc);
  const blockAt = new Map<number, number>();
  doc.forEach((_node, offset, index) => blockAt.set(offset, index));
  const entries = headings.map((h, i) => ({ key: h.id ?? `heading-${i}`, id: h.id, level: h.level, number: h.number, title: h.title }));
  const positions = headings.map((h) => h.pos);
  const plan = headings.map((h) => ({ block: blockAt.get(h.pos)!, level: h.level }));
  return { entries, positions, plan, blockCount: doc.childCount, current: currentHeading(headings, state.selection.from) };
}

/** The table of contents of `state`: entries, the current chapter and what can move. */
export function tocSnapshot(state: EditorState, editable: boolean): TocSnapshot {
  const r = read(state);
  const can = (d: MoveDirection) => editable && r.current >= 0 && planChapterMove(r.plan, r.blockCount, r.current, d) !== null;
  return {
    entries: r.entries,
    currentKey: r.current >= 0 ? r.entries[r.current]!.key : null,
    canMoveUp: can("up"),
    canMoveDown: can("down"),
    editable,
  };
}

/** Same lines, same current chapter, same moves: nothing on screen would change. */
export function sameToc(a: TocSnapshot, b: TocSnapshot): boolean {
  if (a.currentKey !== b.currentKey || a.canMoveUp !== b.canMoveUp || a.canMoveDown !== b.canMoveDown || a.editable !== b.editable) return false;
  if (a.entries.length !== b.entries.length) return false;
  return a.entries.every((e, i) => {
    const o = b.entries[i]!;
    return e.key === o.key && e.id === o.id && e.level === o.level && e.number === o.number && e.title === o.title;
  });
}

/** Position of the heading with `key` in `state` right now (by block id, else by its place among the headings). */
export function headingPosition(state: EditorState, key: string): number | null {
  const pending = /^heading-(\d+)$/u.exec(key);
  if (!pending) return blockPosition(state.doc, key);
  return read(state).positions[Number(pending[1])] ?? null;
}

/** The move of the chapter holding the cursor (or of heading `key`), or null when it cannot move that way. */
function movePlanOf(state: EditorState, direction: MoveDirection, key?: string) {
  const r = read(state);
  const index = key === undefined ? r.current : r.entries.findIndex((e) => e.key === key);
  return index < 0 ? null : planChapterMove(r.plan, r.blockCount, index, direction);
}

/** Whether the chapter holding the cursor (or of heading `key`) can move that way now. */
export function canMoveChapter(state: EditorState, direction: MoveDirection, key?: string): boolean {
  return movePlanOf(state, direction, key) !== null;
}

/**
 * Moves the chapter as a cut and an insert of the same nodes, in two
 * transactions that undo as one. The cut lets the identity plugin remember the
 * chapter's blocks; the insert brings them back unchanged, so every block keeps
 * its id by the plugin's restore rule, which goes by id. A single replace of
 * the whole range would leave it to the move rule, which goes by content and
 * gives up on repeated blocks such as two empty paragraphs (identity.ts rule 2).
 * Every block outside the chapter is not touched at all.
 */
function dispatchChapterMove(editor: Editor, direction: MoveDirection, key?: string): boolean {
  const state = editor.state;
  const plan = movePlanOf(state, direction, key);
  if (!plan) return false;
  const { doc } = state;
  const blockPos = (i: number) => (i < doc.childCount ? offsetOf(doc, i) : doc.content.size);
  const nodes: PmNode[] = [];
  for (let i = plan.chapterFrom; i < plan.chapterTo; i += 1) nodes.push(doc.child(i));
  const cut = state.tr.delete(blockPos(plan.chapterFrom), blockPos(plan.chapterTo));
  const target = cut.mapping.map(blockPos(plan.insertAt));
  editor.view.dispatch(cut);
  // The identity plugin may append a fix after the cut; its steps only set ids
  // and move no position (identity.ts applyFixes), so `target` still holds.
  const at = target;
  const insert = editor.state.tr.insert(at, Fragment.fromArray(nodes));
  insert.setSelection(TextSelection.near(insert.doc.resolve(at + 1)));
  // One undo step for the cut and the insert (prosemirror-history merges an appended transaction).
  insert.setMeta("appendedTransaction", cut);
  editor.view.dispatch(insert.scrollIntoView());
  return true;
}

/**
 * Whether the editor's view is gone. Read from the view, not `editor.isDestroyed`,
 * which also says true for an editor not mounted in a page (tests, server).
 */
function gone(editor: Editor): boolean {
  return editor.view.isDestroyed === true;
}

function offsetOf(doc: PmNode, index: number): number {
  let pos = 0;
  for (let i = 0; i < index; i += 1) pos += doc.child(i).nodeSize;
  return pos;
}

/** Puts the cursor at the start of the heading `key` and scrolls to it; false when it is gone. */
export function goToHeading(editor: Editor, key: string): boolean {
  if (gone(editor)) return false;
  const pos = headingPosition(editor.state, key);
  if (pos === null) return false;
  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.near(editor.state.doc.resolve(pos + 1))).scrollIntoView());
  // ProseMirror focuses at once, so keys typed right after the click reach the text.
  if (!editor.isDestroyed) editor.view.focus();
  return true;
}

/** Moves a chapter in the editor; false when it cannot move or the work is read-only. */
export function moveChapterInEditor(editor: Editor, direction: MoveDirection, key?: string): boolean {
  if (gone(editor) || !editor.isEditable) return false;
  return dispatchChapterMove(editor, direction, key);
}

/** Alt+Shift+↑/↓ moves the chapter holding the cursor (prototype, Struktura). */
export const ChapterMove = Extension.create({
  name: "chapterMove",
  addKeyboardShortcuts() {
    return {
      "Alt-Shift-ArrowUp": () => moveChapterInEditor(this.editor, "up"),
      "Alt-Shift-ArrowDown": () => moveChapterInEditor(this.editor, "down"),
    };
  },
});

/**
 * A live table of contents for `useSyncExternalStore`: the snapshot is read
 * again on every transaction and replaced only when something on screen would
 * change, so typing inside a paragraph does not redraw the list.
 */
export type TocStore = {
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => TocSnapshot;
};

export function createTocStore(editor: Editor | null): TocStore {
  if (!editor) return { subscribe: () => () => {}, getSnapshot: () => EMPTY_TOC };
  const take = () => (gone(editor) ? EMPTY_TOC : tocSnapshot(editor.state, editor.isEditable));
  let snapshot = take();
  const listeners = new Set<() => void>();
  // One editor subscription for all views: the snapshot is replaced once and
  // every view is told, so a second view never compares against a snapshot
  // the first one already took.
  const refresh = () => {
    const next = take();
    if (sameToc(snapshot, next)) return;
    snapshot = next;
    for (const listener of [...listeners]) listener();
  };
  return {
    subscribe(listener) {
      if (listeners.size === 0) {
        editor.on("transaction", refresh);
        editor.on("update", refresh);
      }
      listeners.add(listener);
      // A newly subscribed view may have missed a transaction.
      refresh();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          editor.off("transaction", refresh);
          editor.off("update", refresh);
        }
      };
    },
    getSnapshot: () => snapshot,
  };
}

export type { Editor as TocEditor };
