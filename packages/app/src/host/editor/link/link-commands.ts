// ED-127: Umetni › Poveznica, the prototype's acLink and acLinkDel (acad.js).
// The mark `link` is in schema v4 only (extensions-v4 Link, validated by
// validMark); a v3 work offers the item off, with the reason beside it.
import type { Editor } from "@tiptap/core";

export type LinkOutcome = "done" | "noSelection" | "invalid" | "unavailable";

/** True when the editor's schema has the link mark (a v4 work). */
export const linkAvailable = (editor: Editor | null): boolean =>
  Boolean(editor && !editor.isDestroyed && editor.schema.marks.link);

/** True when the caret or the selection is in a link. */
export const linkActive = (editor: Editor | null): boolean =>
  linkAvailable(editor) && editor!.isActive("link");

/** The address as typed, made whole: "primjer.hr" gets https://, "netko@primjer.hr" gets mailto:. */
export function normalizeHref(typed: string): string {
  const value = typed.trim();
  if (value === "" || /^[a-z][a-z0-9+.-]*:/i.test(value)) return value;
  if (/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(value)) return `mailto:${value}`;
  return `https://${value}`;
}

/** The link on the selected text; the schema's own check refuses an address it would not keep. */
export function applyLink(editor: Editor, typed: string, range?: { from: number; to: number }): LinkOutcome {
  if (!linkAvailable(editor)) return "unavailable";
  const from = range?.from ?? editor.state.selection.from;
  const to = range?.to ?? editor.state.selection.to;
  if (from === to) return "noSelection";
  const href = normalizeHref(typed);
  return editor.chain().focus().setTextSelection({ from, to }).setLink(href).run() ? "done" : "invalid";
}

/** The whole link the caret is in, or the links in the selection, taken off; the text stays. */
export function removeLink(editor: Editor): boolean {
  if (!linkActive(editor)) return false;
  return editor.chain().focus().extendMarkRange("link").unsetLink().run();
}
