// ED-36 (paritet-editor-2 PRIJEDLOG #5, C-02/C-03/C-05): what the writing help
// of a chapter reads from the open document. In this editor "Naslov rada" is
// heading 1, "Poglavlje" heading 2 and "Potpoglavlje" heading 3, so the assist
// rules see chapters at level 2. A heading is keyed like the table of contents
// (its block id, or `heading-<n>` while the id is being minted), so the chapter
// under the cursor and the chapter of the help are the same one. The document
// is only read.
import { NODE_ID_ATTRIBUTE } from "../../../../../editor-core/src/editor/interop.ts";
import { documentSources } from "../../../../../../src/components/editor/sources/proofs/proof-sources.ts";
import { chaptersOf, type AssistBlock, type AssistChapter } from "../assist/blocks";

export const HELP_CHAPTER_LEVEL = 2;

type Json = { readonly type?: unknown; readonly text?: unknown; readonly attrs?: Record<string, unknown>; readonly content?: readonly Json[] };

export type HelpDocument = {
  readonly chapters: readonly AssistChapter[];
  /** Labels of the sources cited in each chapter with its subchapters, by chapter key, each once, in text order. */
  readonly sourceLabels: Readonly<Record<string, readonly string[]>>;
};

export const EMPTY_HELP: HelpDocument = { chapters: [], sourceLabels: {} };

function textOf(node: Json): string {
  if (node.type === "text") return typeof node.text === "string" ? node.text : "";
  if (node.type === "citation" || node.type === "hardBreak") return " ";
  return (node.content ?? []).map(textOf).join("");
}

function citedIds(node: Json, out: string[]): string[] {
  if (node.type === "citation" && typeof node.attrs?.sourceId === "string") out.push(node.attrs.sourceId);
  node.content?.forEach((child) => citedIds(child, out));
  return out;
}

/** The chapters of the editor document (`editor.getJSON()`) and the sources each one cites. */
export function helpDocumentOf(doc: Json | null | undefined): HelpDocument {
  const top = doc?.content ?? [];
  const blocks: AssistBlock[] = [];
  const labels = new Map(documentSources(doc).map((s) => [s.id, s.label]));
  const cited = new Map<string, string[]>();
  let headingIndex = -1;
  let chapterKey: string | null = null;
  // Text before the first chapter and under the title belongs to no chapter.
  let outside = true;
  top.forEach((node, index) => {
    const ids = citedIds(node, []);
    if (node.type === "heading") {
      headingIndex += 1;
      const level = Number(node.attrs?.level);
      const own = node.attrs?.[NODE_ID_ATTRIBUTE];
      const key = typeof own === "string" && own !== "" ? own : `heading-${headingIndex}`;
      // The title of the work is no chapter and holds no chapter's text.
      if (level < HELP_CHAPTER_LEVEL) { chapterKey = null; outside = true; return; }
      if (level === HELP_CHAPTER_LEVEL) chapterKey = key;
      outside = false;
      blocks.push({ id: key, kind: "heading", level, text: textOf(node), cites: ids.length });
    } else {
      if (outside) return;
      blocks.push({ id: `block-${index}`, kind: "text", level: 0, text: textOf(node), cites: ids.length });
    }
    if (chapterKey !== null && ids.length > 0) cited.set(chapterKey, [...(cited.get(chapterKey) ?? []), ...ids]);
  });
  // A plain record, not a Map: the left rail compares snapshots as JSON.
  const sourceLabels: Record<string, readonly string[]> = {};
  for (const [key, ids] of cited) {
    sourceLabels[key] = [...new Set(ids)].flatMap((id) => { const label = labels.get(id); return label ? [label] : []; });
  }
  return { chapters: chaptersOf(blocks, HELP_CHAPTER_LEVEL), sourceLabels };
}
