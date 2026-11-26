// F4-EDI-R19: the text of citation notes in the footnote system (INVENTAR-editor
// §8: first citation in full, then "Ibid.", then "Autor, nav. dj.", "cit. prema"
// for a secondary source). Pure: derived from the document each time, never stored.
import type { CanonicalDocumentV3, DocumentSource, SourceId } from "../document/schema";
import { formatBibliographyEntry, normalizePages } from "./format";
import type { CitationStyle } from "./style";
import type { Author, Source } from "./types";

/** Fixed Croatian labels of the footnote style (INVENTAR-editor §8.5). */
export const FOOTNOTE_LABELS = {
  ibid: "Ibid.",
  workCited: "nav. dj.",
  citedAfter: "cit. prema",
  pages: "str.",
  unknownSource: "Izvor nije u popisu.",
} as const;

export type FootnoteNoteKind = "full" | "ibid" | "short" | "secondary" | "plain" | "orphan";

export type FootnoteNote = {
  /** 1, 2, ... in document order, over citations and plain footnotes together. */
  number: number;
  kind: FootnoteNoteKind;
  text: string;
};

function shortName(author: Author): string {
  return author.kind === "person" ? author.family.trim() : author.acronym?.trim() || author.name.trim();
}

function authorsShort(source: Source, style: CitationStyle): string {
  const names = source.authors.map(shortName);
  const t = style.inText;
  if (names.length > t.maxNamedAuthors) return `${names[0]}${t.manyAuthorsSuffix}`;
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")}${t.twoAuthorsJoiner}${names[names.length - 1]}`;
}

function withPage(text: string, locator: string | undefined, style: CitationStyle): string {
  if (locator === undefined || locator === "") return text;
  // A whitespace-only locator is valid in a document; as elsewhere it is shown as stored.
  const shown = locator.trim() === "" ? locator : normalizePages(locator, style);
  return `${text}, ${FOOTNOTE_LABELS.pages} ${shown}`;
}

function ended(text: string): string {
  return text.endsWith(".") ? text : `${text}.`;
}

function withoutId(source: DocumentSource): Source {
  const rest: Partial<DocumentSource> = { ...source };
  delete rest.id;
  return rest as Source;
}

/**
 * The notes of a document, in order. Rules (assumptions recorded in the PR):
 * - a source cited for the first time: the full bibliography entry, then ", str. N";
 * - the same source directly after its own note: "Ibid." (with ", str. N" if it has a locator);
 * - the same source later: "Autor, nav. dj." (with page);
 * - a citation with `via`: "{via}, cit. prema: …" (never "Ibid."; counts as cited);
 * - a plain footnote shows its text and breaks the "Ibid." sequence;
 * - a citation whose source is missing: "Izvor nije u popisu." and breaks the sequence.
 * Year suffixes are not assigned here: the note shows the record as stored.
 */
export function deriveFootnoteNotes(document: CanonicalDocumentV3, style: CitationStyle): FootnoteNote[] {
  const byId = new Map<SourceId, DocumentSource>(document.sources.map((s) => [s.id, s]));
  const seen = new Set<SourceId>();
  const notes: FootnoteNote[] = [];
  let previous: SourceId | undefined;
  const push = (kind: FootnoteNoteKind, text: string) => notes.push({ number: notes.length + 1, kind, text });
  for (const node of document.nodes) {
    if (!("children" in node)) continue;
    for (const child of node.children) {
      if (child.type === "footnote") {
        push("plain", child.text);
        previous = undefined;
      } else if (child.type === "citation") {
        const doc = byId.get(child.sourceId);
        if (doc === undefined) {
          push("orphan", FOOTNOTE_LABELS.unknownSource);
          previous = undefined;
          continue;
        }
        const source = withoutId(doc);
        const via = "via" in child && typeof child.via === "string" && child.via !== "" ? child.via : undefined;
        const full = () => formatBibliographyEntry(source, style).replace(/\.$/, "");
        const short = () => `${authorsShort(source, style)}, ${FOOTNOTE_LABELS.workCited}`;
        const wasSeen = seen.has(doc.id);
        if (via !== undefined) {
          push("secondary", ended(withPage(`${via}, ${FOOTNOTE_LABELS.citedAfter}: ${wasSeen ? short() : full()}`, child.locator, style)));
          previous = undefined;
        } else if (previous === doc.id) {
          push("ibid", ended(withPage(FOOTNOTE_LABELS.ibid, child.locator, style)));
          previous = doc.id;
        } else if (wasSeen) {
          push("short", ended(withPage(short(), child.locator, style)));
          previous = doc.id;
        } else {
          push("full", ended(withPage(full(), child.locator, style)));
          previous = doc.id;
        }
        seen.add(doc.id);
      }
    }
  }
  return notes;
}
