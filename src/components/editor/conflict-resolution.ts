/**
 * F4-EDI-R05: what the author sees and chooses when the server's work differs
 * from the text on this device (CONFLICT). Pure parts only; the dialog is
 * `ConflictDialog.tsx` and the two choices run through `EvidenceSession`:
 *
 * - "server": the server's version replaces the sheet (`adoptServer`); the
 *   local text stays on the device as a copy, never sent.
 * - "mine": the same take, then the local text is typed into the sheet in one
 *   replacement, so it goes out as a NEW commit on the server's version through
 *   the existing evidence route. Nothing here sends a request.
 */
import type { Editor } from "@tiptap/core";

import type { CanonicalDocument, CanonicalDocumentV3 } from "@/domain/document";
import { canonicalToTiptap, canonicalToTiptapV3 } from "@/editor";

import type { SheetDocument } from "./evidence-session";

export type ConflictChoice = "server" | "mine";

export type ConflictPart = { kind: "same" | "added" | "removed"; text: string };

/** The text of a canonical document, blocks separated by a blank line. */
export function documentText(doc: SheetDocument): string {
  const collect = (value: unknown): string => {
    if (Array.isArray(value)) return value.map(collect).join("");
    if (value === null || typeof value !== "object") return "";
    const node = value as { text?: unknown; children?: unknown; content?: unknown };
    return (typeof node.text === "string" ? node.text : "") + collect(node.children) + collect(node.content);
  };
  const blocks = (doc as { nodes?: unknown }).nodes;
  return Array.isArray(blocks) ? blocks.map(collect).join("\n\n") : "";
}

/** Past this many cells of the word table the middle is shown whole, not word by word. */
const MAX_CELLS = 4_000_000;

const wordsOf = (text: string): string[] => text.split(/\s+/u).filter((word) => word.length > 0);

/**
 * The difference as the dialog shows it, word by word: the server's version is
 * the text the author would be taking, so what only it has is "added" and what
 * only this device has is "removed". Equal ends are trimmed first; a middle too
 * large for a word table is shown as one removed and one added part.
 */
export function conflictParts(local: string, server: string): ConflictPart[] {
  const a = wordsOf(local);
  const b = wordsOf(server);
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head += 1;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail += 1;
  const mid = { a: a.slice(head, a.length - tail), b: b.slice(head, b.length - tail) };
  const kinds: ConflictPart[] = a.slice(0, head).map((text) => ({ kind: "same", text }));
  if ((mid.a.length + 1) * (mid.b.length + 1) > MAX_CELLS) {
    kinds.push(...mid.a.map((text): ConflictPart => ({ kind: "removed", text })), ...mid.b.map((text): ConflictPart => ({ kind: "added", text })));
  } else {
    const width = mid.b.length + 1;
    const table = new Uint32Array((mid.a.length + 1) * width);
    const at = (i: number, j: number): number => table[i * width + j] ?? 0;
    for (let i = mid.a.length - 1; i >= 0; i -= 1) {
      for (let j = mid.b.length - 1; j >= 0; j -= 1) {
        table[i * width + j] = mid.a[i] === mid.b[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
      }
    }
    let i = 0;
    let j = 0;
    while (i < mid.a.length || j < mid.b.length) {
      const x = mid.a[i];
      const y = mid.b[j];
      if (x !== undefined && y !== undefined && x === y) { kinds.push({ kind: "same", text: x }); i += 1; j += 1; }
      else if (y !== undefined && (x === undefined || at(i, j + 1) >= at(i + 1, j))) { kinds.push({ kind: "added", text: y }); j += 1; }
      else if (x !== undefined) { kinds.push({ kind: "removed", text: x }); i += 1; }
    }
  }
  kinds.push(...a.slice(a.length - tail).map((text): ConflictPart => ({ kind: "same", text })));
  return kinds.map((part, index) => ({ kind: part.kind, text: index === 0 ? part.text : ` ${part.text}` }));
}

/**
 * The kept text goes into the sheet the way a change of the author does (one
 * editor command with an update), so the saver journals it, the recorder
 * records it and the drain sends it. False when the sheet is not writable.
 */
export function applyKeptDocument(editor: Editor, doc: SheetDocument, sheet: 1 | 3): boolean {
  if (!editor.isEditable) return false;
  const content = sheet === 3 ? canonicalToTiptapV3(doc as CanonicalDocumentV3) : canonicalToTiptap(doc as CanonicalDocument);
  return editor.commands.setContent(content, { emitUpdate: true });
}

/** How a choice ended: the sheet reloads on "done"; the other two leave everything as it was. */
export type ConflictOutcome = "done" | "refused" | "unavailable";

/** What the sheet offers the dialog while the work is in CONFLICT. */
export type ConflictOffer = {
  /** The server's version, read now and not written; null when there is no usable answer. */
  serverVersion: () => Promise<SheetDocument | null>;
  /** The text of this device, as the sheet holds it; null when the sheet cannot be read. */
  local: () => SheetDocument | null;
  /** Takes the server's version as the base; "mine" then sends the text of this device as a new commit on it. */
  resolve: (choice: ConflictChoice) => Promise<ConflictOutcome>;
};
