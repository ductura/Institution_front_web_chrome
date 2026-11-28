/**
 * ED-117 (prototype sources2.js srcPlan, s2Plan): "Planirano za poglavlja". The student marks for which
 * chapters a source is meant, and the panel lists the planned sources a chapter does not cite yet. The
 * server has no field for it, so the plan stays on this device, per work, as the state of a source does.
 * A chapter is keyed like the writing help keys it (left/chapter-help.ts), so it survives renumbering.
 */
import { NODE_ID_ATTRIBUTE } from "../../../../../../editor-core/src/editor/interop.ts";
import { HELP_CHAPTER_LEVEL, helpDocumentOf } from "../../left/chapter-help";
import type { BibSource } from "./bibliography-model";

type Json = { readonly type?: unknown; readonly attrs?: Record<string, unknown>; readonly content?: readonly Json[] };

/** Chapter keys by source id, each key once, in the order they were added. */
export type SourcePlan = Readonly<Record<string, readonly string[]>>;
export type PlanChapter = { readonly id: string; readonly number: string; readonly title: string; readonly cited: ReadonlySet<string> };
export type PlanGap = { readonly chapter: PlanChapter; readonly sources: readonly BibSource[] };

const KEY = (documentId: string) => `ductura.editor.source-plan:${documentId}`;

type Store = Pick<Storage, "getItem" | "setItem">;
const local = (): Store | null => { try { return globalThis.localStorage ?? null; } catch { return null; } };

export function readPlan(documentId: string, store: Store | null = local()): SourcePlan {
  try {
    const parsed: unknown = JSON.parse(store?.getItem(KEY(documentId)) ?? "{}");
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const out: Record<string, string[]> = {};
    for (const [id, keys] of Object.entries(parsed)) {
      if (!Array.isArray(keys)) continue;
      const valid = keys.filter((k, i): k is string => typeof k === "string" && k !== "" && keys.indexOf(k) === i);
      if (valid.length > 0) out[id] = valid;
    }
    return out;
  } catch { return {}; }
}

export function writePlan(documentId: string, plan: SourcePlan, store: Store | null = local()): void {
  try { store?.setItem(KEY(documentId), JSON.stringify(plan)); } catch { /* the plan is a convenience */ }
}

/** The plan with the chapter added to the source, or taken away when it was there; an empty list leaves no key. */
export function togglePlan(plan: SourcePlan, sourceId: string, chapterId: string): SourcePlan {
  const { [sourceId]: current = [], ...rest } = plan;
  const next = current.includes(chapterId) ? current.filter((k) => k !== chapterId) : [...current, chapterId];
  return next.length > 0 ? { ...rest, [sourceId]: next } : rest;
}

function citedIds(node: Json, out: string[]): string[] {
  if (node.type === "citation" && typeof node.attrs?.sourceId === "string") out.push(node.attrs.sourceId);
  node.content?.forEach((child) => citedIds(child, out));
  return out;
}

/** The chapters of the document with the ids of the sources each cites, its subchapters included. */
export function planChapters(doc: Json | null | undefined): PlanChapter[] {
  const cited = new Map<string, Set<string>>();
  let headingIndex = -1;
  let current: string | null = null;
  for (const node of doc?.content ?? []) {
    if (node.type === "heading") {
      headingIndex += 1;
      const level = Number(node.attrs?.level);
      const own = node.attrs?.[NODE_ID_ATTRIBUTE];
      if (level < HELP_CHAPTER_LEVEL) current = null;
      else if (level === HELP_CHAPTER_LEVEL) current = typeof own === "string" && own !== "" ? own : `heading-${headingIndex}`;
    }
    if (current === null) continue;
    const set = cited.get(current) ?? new Set<string>();
    citedIds(node, []).forEach((id) => set.add(id));
    cited.set(current, set);
  }
  return helpDocumentOf(doc).chapters.filter((c) => c.level === HELP_CHAPTER_LEVEL)
    .map((c) => ({ id: c.id, number: c.number.replace(/\.$/u, ""), title: c.title, cited: cited.get(c.id) ?? new Set<string>() }));
}

/** The chapters a source is planned for that still exist, in document order. */
export function plannedChapters(plan: SourcePlan, sourceId: string, chapters: readonly PlanChapter[]): PlanChapter[] {
  const keys = plan[sourceId] ?? [];
  return chapters.filter((c) => keys.includes(c.id));
}

/** For each chapter, the sources planned for it that it does not cite yet ("Planirano za ovo poglavlje, još nije citirano"). */
export function planGaps(plan: SourcePlan, chapters: readonly PlanChapter[], sources: readonly BibSource[]): PlanGap[] {
  return chapters.map((chapter) => ({
    chapter,
    sources: sources.filter((s) => (plan[s.id] ?? []).includes(chapter.id) && !chapter.cited.has(s.id)),
  })).filter((gap) => gap.sources.length > 0);
}
