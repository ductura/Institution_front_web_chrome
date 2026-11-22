// WEB-2125 (parity E§3.3, proposal 4): the footnote and the cross reference in
// the host. The live editor mounts the v1 extensions and the server does not
// yet say which document schema a work is confirmed in (contract §7), so
// nothing may write either atom: both stay unavailable until it does, with
// the reason drawn. The targets (Poglavlja and Prikazi) are derived here so a
// dialog needs no logic of its own once the version arrives.
import { academicAtomsHr as t } from "./messages.hr";

/** Schema versions whose editor carries both atoms (document schema v3, v4). */
const ATOM_VERSIONS: ReadonlySet<number> = new Set([3, 4]);

export type AtomAvailability =
  | { kind: "available" }
  | { kind: "unavailable"; reason: "unconfirmed" | "readOnly" };

/**
 * Whether a footnote or a cross reference may be inserted. A version the
 * server has not confirmed, or an editor without both nodes, is unconfirmed:
 * the atom would be written into a work held at a lower version.
 */
export function atomAvailability(input: {
  confirmedVersion: number | null;
  schemaHasAtoms: boolean;
  editable: boolean;
}): AtomAvailability {
  if (input.confirmedVersion === null || !ATOM_VERSIONS.has(input.confirmedVersion) || !input.schemaHasAtoms) {
    return { kind: "unavailable", reason: "unconfirmed" };
  }
  if (!input.editable) return { kind: "unavailable", reason: "readOnly" };
  return { kind: "available" };
}

export type InsertItem = {
  id: "footnote" | "crossReference";
  label: string;
  hint: string;
  disabled: boolean;
  /** Why the item is disabled, drawn next to it. */
  note: string | null;
  onSelect(): void;
};

/** The two items of Umetni, in prototype order. */
export function insertItems(availability: AtomAvailability, open: (id: InsertItem["id"]) => void): InsertItem[] {
  const note = availability.kind === "available" ? null : availability.reason === "readOnly" ? t.readOnly : t.unconfirmed;
  const item = (id: InsertItem["id"], label: string, hint: string): InsertItem => ({
    id,
    label,
    hint,
    disabled: note !== null,
    note,
    onSelect: () => {
      if (note === null) open(id);
    },
  });
  return [item("footnote", t.footnote, t.footnoteHint), item("crossReference", t.crossReference, t.crossReferenceHint)];
}

/** A chapter as the outline numbers it (numberedHeadings). */
export type ChapterInput = { id: string | null; number: string; title: string };
/** A top-level block of the document; only tables and images are read. */
export type BlockInput = { type: string; id?: string | null; title?: string | null };

export type XrefTarget = { id: string; label: string; title: string };
export type XrefTargets = { chapters: XrefTarget[]; exhibits: XrefTarget[] };

/**
 * The targets of a cross reference: the chapters, then the exhibits numbered
 * per kind in document order ("Tablica 1", "Slika 1"). A block without an id
 * yet keeps its number but cannot be a target.
 */
export function crossReferenceTargets(chapters: readonly ChapterInput[], blocks: readonly BlockInput[]): XrefTargets {
  const counts = { table: 0, image: 0 };
  const exhibits: XrefTarget[] = [];
  for (const block of blocks) {
    if (block.type !== "table" && block.type !== "image") continue;
    const n = ++counts[block.type];
    if (!block.id) continue;
    const kind = block.type === "table" ? t.table : t.image;
    exhibits.push({ id: block.id, label: `${kind} ${n}`, title: block.title?.trim() ?? "" });
  }
  return {
    chapters: chapters.flatMap((c) => (c.id ? [{ id: c.id, label: c.number, title: c.title }] : [])),
    exhibits,
  };
}

/** What a cross reference shows: its target's label, or the missing note. */
export function crossReferenceText(
  targetId: string,
  targets: XrefTargets,
): { found: true; label: string } | { found: false; note: string } {
  const hit = [...targets.chapters, ...targets.exhibits].find((x) => x.id === targetId);
  return hit ? { found: true, label: hit.label } : { found: false, note: t.missing };
}
