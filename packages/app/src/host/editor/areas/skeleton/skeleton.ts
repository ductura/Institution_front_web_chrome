// WEB-V21-DRU-KOSTUR: the section skeleton of an area-"dru" work. Only headings go into the document, at its end,
// never twice; nothing leaves the browser. The list is the rule profile's sections, or a default when it has none.
import type { Editor } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";

import { skeletonMessages as msg } from "./messages.hr";
import { setupOf } from "../../rules/rules-model";
import type { RuleProfile } from "../../rules/profiles";

/** Used when the profile names no sections. */
export const DEFAULT_SECTIONS = [
  "Uvod", "Teorijski okvir", "Metodologija", "Rezultati", "Rasprava", "Zaključak", "Literatura",
] as const;

/** Profile section keys that have their own tool (declaration in "Dijelovi rada", contents generated), so no heading here. */
const LITERATURE = "literatura";
const HAS_OWN_TOOL: ReadonlySet<string> = new Set(["izjava", "sadržaj"]);

const normal = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/\s+/g, " ");
const titleOf = (key: string) => { const k = key.trim(); return k.charAt(0).toUpperCase() + k.slice(1); };

/** The skeleton is offered for the area "dru" only. */
export const skeletonAvailable = (profile: RuleProfile | null): boolean => !profile || setupOf(profile).area === "dru";

/** Section titles to offer: the profile's, or the default list when it has none (or none that is a heading). */
export function skeletonSections(profile: RuleProfile | null): string[] {
  const fromProfile = (profile?.sections ?? []).filter((k) => k.trim() && !HAS_OWN_TOOL.has(k)).map(titleOf);
  const list = fromProfile.length > 0 ? fromProfile : [...DEFAULT_SECTIONS];
  return list.filter((t, i) => list.findIndex((u) => normal(u) === normal(t)) === i);
}

/** Which of the titles a heading of the document already carries (same words, letter case and accents ignored). */
export function presentTitles(doc: Node, titles: readonly string[]): Set<string> {
  const have = new Set<string>();
  doc.descendants((node) => { if (node.type.name === "heading") have.add(normal(node.textContent)); });
  return new Set(titles.filter((t) => have.has(normal(t))));
}

export type SkeletonAvailability = { readonly enabled: true } | { readonly enabled: false; readonly reason?: string };

/** The menu item: off, with the reason, outside area "dru" or when every section of the list is already in the work. */
export function skeletonAvailability(editor: Editor | null, profile: RuleProfile | null): SkeletonAvailability {
  if (!skeletonAvailable(profile)) return { enabled: false, reason: msg.unavailable };
  if (!editor || editor.isDestroyed) return { enabled: true };
  const titles = skeletonSections(profile);
  return presentTitles(editor.state.doc, titles).size >= titles.length ? { enabled: false, reason: msg.none } : { enabled: true };
}

/** Where headings before "Literatura" go: the start of the document's own Literatura heading, or null when it has none. */
function literaturePos(doc: Node): number | null {
  let at: number | null = null;
  doc.descendants((node, pos) => {
    if (at === null && node.type.name === "heading" && normal(node.textContent) === LITERATURE) at = pos;
    return at === null;
  });
  return at;
}

/**
 * Adds the chosen headings (level 2) in one transaction, skipping titles the document already has. They go before the
 * work's own "Literatura" heading (the list stays last), otherwise at the end; a chosen "Literatura" goes last.
 * Returns how many were added, or null when the editor refuses (gone, read-only).
 */
export function applySkeleton(editor: Editor | null, chosen: readonly string[]): number | null {
  if (!editor || editor.isDestroyed || !editor.isEditable) return null;
  const heading = editor.schema.nodes.heading;
  if (!heading) return null;
  const present = presentTitles(editor.state.doc, chosen);
  const seen = new Set<string>();
  const add = chosen.filter((t) => {
    const key = normal(t);
    if (!key || present.has(t) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (add.length === 0) return 0;
  const tr = editor.state.tr;
  const node = (title: string) => heading.create({ level: 2 }, editor.schema.text(title));
  const last = add.filter((title) => normal(title) === LITERATURE);
  const before = add.filter((title) => normal(title) !== LITERATURE);
  const lit = literaturePos(editor.state.doc);
  if (lit === null) tr.insert(tr.doc.content.size, [...before, ...last].map(node));
  else {
    // The later position first, so the earlier one is still where it was measured.
    if (last.length > 0) tr.insert(tr.doc.content.size, last.map(node));
    if (before.length > 0) tr.insert(lit, before.map(node));
  }
  editor.view.dispatch(tr);
  return add.length;
}
