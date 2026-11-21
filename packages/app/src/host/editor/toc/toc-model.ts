// WEB-1602 (M5.3, DAN-395): the table of contents of the editor shell as data.
// Every number comes from the one chapter projection in
// @ductura/editor-core/outline (deriveChapters, by block id); the host only
// turns its snapshot into what the @ductura/ui outline draws.
import { tocText, type TocSnapshot } from "../../../../../editor-core/src/outline/index.ts";
import type { OutlineEntry } from "@ductura/ui";

import { tocHr as t } from "./messages.hr";

/** The lines of the outline; the key is the heading's block id, so a moved chapter keeps its line. */
export function outlineEntriesOf(snapshot: TocSnapshot): OutlineEntry[] {
  return snapshot.entries.map((e) => ({
    id: e.key,
    number: e.number,
    title: e.title,
    level: Math.min(3, Math.max(1, Math.trunc(e.level))) as 1 | 2 | 3,
  }));
}

/** The text "Kopiraj sadržaj rada" puts on the clipboard. */
export function tocCopyText(snapshot: TocSnapshot): string {
  return tocText(snapshot.entries, t.untitled);
}

/** Which move buttons the shell shows: none in a read-only work (prototype, Struktura). */
export function moveButtons(snapshot: TocSnapshot): { up: boolean; down: boolean } | null {
  if (!snapshot.editable || snapshot.entries.length === 0) return null;
  return { up: snapshot.canMoveUp, down: snapshot.canMoveDown };
}
