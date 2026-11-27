// ED-104 (prototype text2.js holePop, t2Link, t2HSrc; INVENTAR-editor 1460-1464): a "Za provjeru" mark that asks for
// a source ([izvor…], [citat…], [stranica…]) offers the work's sources, and choosing one turns the mark into a
// citation in its place. Any other mark can say "Zapravo treba izvor", which writes "[izvor]" in its place.
import type { Node as PmNode } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/core";

import { citationRange, insertCitation } from "@/components/editor/citations/citation-document";
import { documentSources } from "@/components/editor/sources/proofs/proof-sources";
import type { Place } from "./marks-model";

const ASKS_SOURCE = /^\[(?:izvor|citat|stranica)/iu;

/** Whether the hole at `place` asks for a source rather than for something to check. */
export function holeNeedsSource(doc: PmNode, place: Place): boolean {
  return place.kind === "hole" && ASKS_SOURCE.test(doc.textBetween(place.from, place.to, "", ""));
}

/** The work's sources, for the list of the popover. */
export function sourcesOf(doc: PmNode): { id: string; label: string }[] {
  return documentSources({ attrs: { sources: doc.attrs.sources } } as never).map((s) => ({ id: s.id, label: s.label }));
}

/** Replaces the hole with a citation of `sourceId`; false when the text cannot be written or the source is gone. */
export function linkHoleToSource(editor: Editor | null, place: Place, sourceId: string): boolean {
  if (!editor || editor.isDestroyed || !editor.isEditable || place.kind !== "hole") return false;
  editor.commands.setTextSelection({ from: place.from, to: place.to });
  const range = citationRange(editor.state);
  const tr = range && insertCitation(editor.state, range, sourceId, "");
  if (!tr) return false;
  editor.view.dispatch(tr);
  editor.commands.focus();
  return true;
}

/** "Zapravo treba izvor": writes "[izvor]" in the place of the hole. */
export function askSourceInstead(editor: Editor | null, place: Place): boolean {
  if (!editor || editor.isDestroyed || !editor.isEditable || place.kind !== "hole") return false;
  return editor.chain().focus().insertContentAt({ from: place.from, to: place.to }, "[izvor]").run();
}
