// WEB-2125: model fusnote i unakrsne reference. Čist TypeScript, bez uređivača:
// priprema teksta, brojevi fusnota po redu u dokumentu, ciljevi poveznice i
// razlog zašto je umetanje isključeno. Brojevi poglavlja dolaze iz jedne
// projekcije (editor-core/outline), nikad drugim brojanjem.
import type { Node as PmNode, Schema } from "@tiptap/pm/model";

import { CROSS_REFERENCE, FOOTNOTE } from "../../../../../editor-core/src/editor/atoms-v3.ts";
import { isAllowedTrimmedText } from "../../../../../editor-core/src/document/document/forbidden.ts";
import { MAX_FOOTNOTE_TEXT_CODE_POINTS } from "../../../../../editor-core/src/document/document/schema.ts";
import { numberedHeadings } from "../../../../../editor-core/src/outline/index.ts";

import { crossReferenceHr, footnoteHr } from "./messages.hr";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Jedan odlomak, bez oznaka kraja retka. Prazan rezultat u uređivanju znači „ukloni”; null = neispravno. */
export function prepareFootnoteText(input: string): string | null {
  const text = input.replace(/\r\n|[\r\n\t]/g, " ").replace(/^\p{White_Space}+|\p{White_Space}+$/gu, "");
  return text === "" || isAllowedTrimmedText(text, MAX_FOOTNOTE_TEXT_CODE_POINTS) ? text : null;
}

export type FootnoteEntry = { readonly number: number; readonly pos: number; readonly text: string };

/** Fusnote redom kojim stoje u dokumentu, numerirane od 1. */
export function footnotesOf(doc: PmNode): FootnoteEntry[] {
  const out: FootnoteEntry[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === "footnote") out.push({ number: out.length + 1, pos, text: String(node.attrs.text ?? "") });
  });
  return out;
}

export type CrossReferenceTarget = { readonly id: string; readonly number: string; readonly label: string };

/** Poglavlja s ispravnim id-em; prikazi (tablice, slike) nisu u shemi pa ih nema. */
export function crossReferenceTargets(doc: PmNode): CrossReferenceTarget[] {
  return numberedHeadings(doc)
    .filter((h): h is typeof h & { id: string } => h.id !== null && UUID_V4.test(h.id))
    .map((h) => ({ id: h.id, number: h.number, label: `${crossReferenceHr.heading} ${h.number} ${h.title}`.trimEnd() }));
}

export type AtomAvailability = { enabled: true } | { enabled: false; reason: string };

/** Shema v3 (docs/contracts/document-schema-v3.md): oba čvora su inline atomi. */
export function supportsAcademicAtoms(schema: Schema, schemaVersion: number | undefined): boolean {
  const f = schema.nodes[FOOTNOTE];
  const c = schema.nodes[CROSS_REFERENCE];
  return schemaVersion === 3 && !!f?.isInline && f.isAtom && !!c?.isInline && c.isAtom;
}

/** Fusnota i unakrsna referenca: uključene samo uz shemu v3 i uređiv rad. */
export function atomAvailability(schema: Schema, schemaVersion: number | undefined, editable: boolean): AtomAvailability {
  if (!supportsAcademicAtoms(schema, schemaVersion)) return { enabled: false, reason: footnoteHr.disabledSchema };
  if (!editable) return { enabled: false, reason: footnoteHr.disabledReadOnly };
  return { enabled: true };
}
