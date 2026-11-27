/**
 * Text elements of one work as the teacher reads them (WEB-2153): the citation (`.ed-cite`), the open
 * place for a source (`.ed-open`) and the footnotes (`.ed-notes`). Pure: it turns a versioned document
 * into display blocks and writes nothing. A citation whose source the document does not hold is shown as
 * the open place for a source; nothing is guessed about it.
 */
import type { DocumentNode, DocumentNodeV3, DocumentSource, InlineNodeV3, Mark, VersionedDocument } from "../../../../../editor-core/src/document/document";

export type Piece =
  | { kind: "text"; text: string; marks: readonly Mark[] }
  | { kind: "cite"; label: string }
  | { kind: "open" }
  | { kind: "note"; number: number }
  | { kind: "ref"; heading: string };

export type Block = { id: string; type: DocumentNode["type"]; level?: number; pieces: Piece[] };
export type Elements = { blocks: Block[]; notes: { number: number; text: string }[]; hasElements: boolean };

function name(source: DocumentSource): string {
  const first = source.authors[0];
  if (first === undefined) return source.title;
  const base = first.kind === "person" ? first.family : (first.acronym ?? first.name);
  if (source.authors.length === 1) return base;
  const second = source.authors[1]!;
  const other = second.kind === "person" ? second.family : (second.acronym ?? second.name);
  return source.authors.length === 2 ? `${base} i ${other}` : `${base} i dr.`;
}

/** `(Autor A, 2019: 14)`; the locator is shown exactly as stored. */
export function citationLabel(source: DocumentSource, locator?: string): string {
  return `(${name(source)}, ${source.year}${locator === undefined || locator === "" ? "" : `: ${locator}`})`;
}

export function buildElements(doc: VersionedDocument): Elements {
  const sources = new Map<string, DocumentSource>();
  if ("sources" in doc) for (const s of doc.sources) sources.set(s.id, s);
  const notes: Elements["notes"] = [];
  let hasElements = false;
  const blocks = (doc.nodes as readonly DocumentNodeV3[]).map((node): Block => {
    const pieces: Piece[] = [];
    for (const child of node.children as readonly InlineNodeV3[]) {
      if (child.type === "text") { pieces.push({ kind: "text", text: child.text, marks: child.marks }); continue; }
      hasElements = true;
      if (child.type === "citation") {
        const source = sources.get(child.sourceId);
        pieces.push(source === undefined ? { kind: "open" } : { kind: "cite", label: citationLabel(source, child.locator) });
      } else if (child.type === "footnote") {
        notes.push({ number: notes.length + 1, text: child.text });
        pieces.push({ kind: "note", number: notes.length });
      } else {
        const target = (doc.nodes as readonly DocumentNodeV3[]).find((n) => n.id === child.targetId);
        const heading = target?.type === "heading"
          ? (target.children as readonly InlineNodeV3[]).map((c) => (c.type === "text" ? c.text : "")).join("").trim() : "";
        pieces.push({ kind: "ref", heading });
      }
    }
    return { id: node.id, type: node.type, ...(node.type === "heading" ? { level: node.level } : {}), pieces };
  });
  return { blocks, notes, hasElements };
}

/**
 * The elements of the document the shared live reader already holds (NAS-R19): a v3 text with a
 * citation or footnote is drawn by the elements view as the main path, not only when the reader fails.
 * Null for any other text, which the shared reader draws as before.
 */
export function elementsOfLive(doc: { schemaVersion: number } | null): Elements | null {
  if (doc === null || doc.schemaVersion !== 3) return null;
  const elements = buildElements(doc as VersionedDocument);
  return elements.hasElements ? elements : null;
}
