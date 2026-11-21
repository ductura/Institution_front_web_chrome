// WEB-1601 (M5.2, DAN-211, DAN-214): the toolbar of the editor shell as data.
// The host holds no editor of its own: the shell hands in what the editor can
// do and what state it is in, and this file turns that into the groups the
// @ductura/ui toolbar draws, the outline and the progress against the range.
import { bodyWordCount, editorToolbarHr as t, type EditorToolbarGroup, type OutlineEntry, type ProgressBlock, type WordRange } from "@ductura/ui";

import { ariaKeyShortcuts } from "../shortcuts/shortcut-definitions";

export type BlockStyle = "paragraph" | "heading1" | "heading2" | "heading3";

/** What the editor reports about the selection. */
export type ToolbarState = {
  canUndo: boolean;
  canRedo: boolean;
  block: BlockStyle;
  bold: boolean;
  italic: boolean;
  bulletList: boolean;
  numberedList: boolean;
  quote: boolean;
  /** No editor yet (the journal is still being read) or a read-only work. */
  editable: boolean;
};

/** What the toolbar may ask the editor to do. */
export type ToolbarCommands = {
  undo(): void;
  redo(): void;
  setBlock(style: BlockStyle): void;
  toggleBold(): void;
  toggleItalic(): void;
  toggleBulletList(): void;
  toggleNumberedList(): void;
  toggleQuote(): void;
};

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/u.test(navigator.platform ?? "");
// WEB-1908: the keys come from the one shortcut definition the list is drawn from.
const keysOf = (id: string) => ariaKeyShortcuts(id, IS_MAC);

export function toolbarGroups(state: ToolbarState, run: ToolbarCommands): EditorToolbarGroup[] {
  const off = !state.editable;
  const block = (style: BlockStyle, label: string, icon: "paragraph" | "heading", shortcut?: string) =>
    ({ id: style, label, icon, pressed: state.block === style, disabled: off, shortcut, onSelect: () => run.setBlock(style) }) as const;
  return [
    { id: "history", label: t.history, actions: [
      { id: "undo", label: t.undo, icon: "undo", disabled: off || !state.canUndo, shortcut: keysOf("undo"), onSelect: run.undo },
      { id: "redo", label: t.redo, icon: "redo", disabled: off || !state.canRedo, shortcut: keysOf("redo"), onSelect: run.redo },
    ] },
    { id: "block", label: t.blockStyle, actions: [
      block("paragraph", t.paragraph, "paragraph", keysOf("paragraph")),
      block("heading1", t.heading1, "heading", keysOf("heading1")),
      block("heading2", t.heading2, "heading", keysOf("heading2")),
      block("heading3", t.heading3, "heading", keysOf("heading3")),
    ] },
    { id: "text", label: t.text, actions: [
      { id: "bold", label: t.bold, icon: "bold", pressed: state.bold, disabled: off, shortcut: keysOf("bold"), onSelect: run.toggleBold },
      { id: "italic", label: t.italic, icon: "italic", pressed: state.italic, disabled: off, shortcut: keysOf("italic"), onSelect: run.toggleItalic },
    ] },
    { id: "blocks", label: t.blocks, actions: [
      { id: "bulletList", label: t.bulletList, icon: "bulletList", pressed: state.bulletList, disabled: off, onSelect: run.toggleBulletList },
      { id: "numberedList", label: t.numberedList, icon: "numberedList", pressed: state.numberedList, disabled: off, shortcut: keysOf("numberedList"), onSelect: run.toggleNumberedList },
      { id: "quote", label: t.quote, icon: "quote", pressed: state.quote, disabled: off, onSelect: run.toggleQuote },
    ] },
  ];
}

/** A heading of the document as the editor lists it. */
export type HeadingInput = { id: string; level: number; title: string };

/** Numbers the headings "1.", "1.1.", "1.1.1." by level; levels above 3 are listed as 3. */
export function outlineEntries(headings: readonly HeadingInput[]): OutlineEntry[] {
  const counters = [0, 0, 0];
  return headings.map((h) => {
    const level = (Math.min(3, Math.max(1, Math.trunc(h.level))) as 1 | 2 | 3);
    counters[level - 1] = (counters[level - 1] ?? 0) + 1;
    for (let i = level; i < 3; i++) counters[i] = 0;
    return { id: h.id, level, title: h.title, number: counters.slice(0, level).join(".") };
  });
}

/** The heading that holds the cursor: the last one at or before it. */
export function currentHeadingId(positions: readonly { id: string; pos: number }[], cursor: number): string | null {
  let current: string | null = null;
  for (const p of positions) if (p.pos <= cursor) current = p.id;
  return current;
}

/** Words for the progress: the body only, footnotes left out. */
export function progressWords(blocks: readonly ProgressBlock[]): number {
  return bodyWordCount(blocks);
}

export type { WordRange };
