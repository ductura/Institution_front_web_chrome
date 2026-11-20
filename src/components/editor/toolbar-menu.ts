/**
 * Pure keyboard and layout logic of the editor toolbar and its menus (FE-D5,
 * design editor-v11: "Više ▾" and "Prikaz ▾"; WAI-ARIA toolbar and menu
 * button patterns). No DOM here, so every key is unit-tested.
 */

/** Roving focus among the toolbar's own buttons; -1 for a key it ignores. */
export function rovingIndex(key: string, at: number, count: number): number {
  if (count <= 0 || at < 0) return -1;
  switch (key) {
    case "ArrowRight": return (at + 1) % count;
    case "ArrowLeft": return (at - 1 + count) % count;
    case "Home": return 0;
    case "End": return count - 1;
    default: return -1;
  }
}

/**
 * A key on a menu button: which item the menu opens on, or null. Enter and
 * Space are left to the button's own click, which opens on the first item,
 * so one key press never both opens and closes.
 */
export function openerKey(key: string): "first" | "last" | null {
  if (key === "ArrowDown") return "first";
  if (key === "ArrowUp") return "last";
  return null;
}

export type MenuKeyAction = { kind: "move"; to: number } | { kind: "close" } | null;

/**
 * A key inside an open menu with `count` items, focus on item `at`. Enter and
 * Space are the item's own click; Tab leaves and the blur closes the menu.
 */
export function menuKey(key: string, at: number, count: number): MenuKeyAction {
  if (key === "Escape") return { kind: "close" };
  if (count <= 0) return null;
  switch (key) {
    case "ArrowDown": return { kind: "move", to: (at + 1) % count };
    case "ArrowUp": return { kind: "move", to: (at - 1 + count) % count };
    case "Home": return { kind: "move", to: 0 };
    case "End": return { kind: "move", to: count - 1 };
    default: return null;
  }
}

/**
 * The order in which tools leave the toolbar for "Više" when it is too narrow
 * (WEB-15, E§3.6 toolbar2 priorities, smallest first: Ponovi 20, Blok-citat
 * 24, Popis 25). The block style never collapses (prototype), and undo, bold
 * and italic stay on the toolbar: a phone has no keyboard shortcut for undo.
 */
export const COLLAPSE_ORDER = ["redo", "quote", "bulletItem"] as const;

export const MAX_COLLAPSED = COLLAPSE_ORDER.length;

/** Splits the tools, kept in toolbar order, into shown and moved to "Više". */
export function splitTools<T extends { key: string }>(
  tools: readonly T[],
  collapsed: number,
): { shown: T[]; more: T[] } {
  const n = Math.max(0, Math.min(collapsed, MAX_COLLAPSED));
  const out = new Set<string>(COLLAPSE_ORDER.slice(0, n));
  return {
    shown: tools.filter((tool) => !out.has(tool.key)),
    more: tools.filter((tool) => out.has(tool.key)),
  };
}

// WEB-6C (E§3.3, E§3.6): the toolbar's menus Umetni, Pretvori, Izvezi and
// "Posebni znak". Data and commands only; the labels live in messages.hr.

/** The prototype's special characters, in its order (U+00A0 is the last). */
export const SPECIAL_CHARS = [
  "„", "”", "‚", "’", "»", "«", "–", "…", "°", "×", "±", "≤", "≥", "≠", "≈",
  "§", "€", "‰", "†", "µ", "α", "β", "χ", "²", "³", "½", "→", " ",
] as const;

export const RECENT_MAX = 7;
const RECENT_KEY = "ductura.editor.chars";

/** The character first, the rest in order, without a repeat, at most seven. */
export function pushRecent(recent: readonly string[], ch: string): string[] {
  return [ch, ...recent.filter((c) => c !== ch)].slice(0, RECENT_MAX);
}

/** A non-breaking space is drawn as ⎵, as in the prototype. */
export const glyphOf = (ch: string): string => (ch === " " ? "⎵" : ch);

/** Recent characters from this browser; empty when storage is not there. */
export function readRecent(): string[] {
  try {
    const parsed: unknown = JSON.parse(globalThis.localStorage?.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((c): c is string => typeof c === "string" && (SPECIAL_CHARS as readonly string[]).includes(c)).slice(0, RECENT_MAX)
      : [];
  } catch {
    return [];
  }
}

export function writeRecent(recent: readonly string[]): void {
  try {
    globalThis.localStorage?.setItem(RECENT_KEY, JSON.stringify(recent));
  } catch {
    // Without storage the characters still work; only the recent list is lost.
  }
}

/** The one editor surface the commands below need (a Tiptap editor fits). */
type Writable = {
  isDestroyed: boolean;
  isEditable: boolean;
  isActive: (name: string) => boolean;
  getText: () => string;
  chain: () => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

const writable = (e: Writable | null): e is Writable => !!e && !e.isDestroyed && e.isEditable;

/** Plain text at the caret, over the selection, as typing does; no HTML is parsed. */
const typeAt = (editor: Writable, text: string): boolean => {
  editor.chain().focus().command(({ tr }: { tr: { insertText: (t: string) => unknown } }) => {
    tr.insertText(text);
    return true;
  }).run();
  return true;
};

/** Types the character at the caret, or over the selection. */
export function insertChar(editor: Writable | null, ch: string): boolean {
  if (!writable(editor) || !(SPECIAL_CHARS as readonly string[]).includes(ch)) return false;
  return typeAt(editor, ch);
}

/** The prototype's "Za provjeru": a [?] mark to come back to. */
export function insertHole(editor: Writable | null): boolean {
  if (!writable(editor)) return false;
  return typeAt(editor, "[?] ");
}

/** Selection into a quote, or the quote back into a paragraph; false when already so. */
export function convertBlock(editor: Writable | null, to: "quote" | "paragraph"): boolean {
  if (!writable(editor) || editor.isActive("quote") === (to === "quote")) return false;
  editor.chain().focus().toggleNode("quote", "paragraph").run();
  return true;
}

/** "Kopiraj tekst rada": plain text of the sheet; false when the browser refuses. */
export async function copyText(editor: Writable | null): Promise<boolean> {
  if (!editor || editor.isDestroyed) return false;
  try {
    await globalThis.navigator.clipboard.writeText(editor.getText());
    return true;
  } catch {
    return false;
  }
}
