/**
 * WEB-V20-STIL-POPIS: the student's list of literature and the in-text citations, formatted in the style of the
 * institution. Pure and read only: the document JSON goes in, text comes out; nothing is written to the document
 * and nothing is sent anywhere. The student does not choose the style (see ../../citation-styles).
 *
 * Author-date styles use assignYearSuffixes, sortBibliography, formatBibliographyEntry and formatCitationInText
 * (the same steps as deriveBibliography, which does not look at the numeric branch here); numeric styles number the
 * sources by first citation and list them in that order, as deriveBibliography does.
 */
import {
  assignYearSuffixes,
  formatBibliographyEntry,
  formatCitationInText,
  formatNumberedBibliographyEntry,
  formatNumericCitation,
  sortBibliography,
  type CitationStyle,
  type Source,
} from "../../../../../../editor-core/src/document/citation/index.ts";
import { citationStyleOf, DEFAULT_STYLE_ID, styleNameOf, type StyleId } from "../../citation-styles/catalog";
import { citationStyleText } from "../../citation-styles/messages.hr";
import type { InstitutionStyleRead } from "../../citation-styles/use-institution-style";

type Json = { type?: unknown; attrs?: Record<string, unknown>; content?: readonly Json[] };

export type StyledEntry = { sourceId: string; text: string; number?: number };
export type StyledCitation = { index: number; sourceId: string; text: string };
export type StyledLiterature = {
  /** Cited sources only, in the order of the style (alphabetical, or by first citation for numeric styles). */
  entries: StyledEntry[];
  /** Every citation of a known source, in text order. */
  citations: StyledCitation[];
  /** Cited sources the style cannot format (a required field is missing); they get no entry and no number. */
  unformatted: string[];
  /** Citations whose source is not in the document's sources. */
  orphanCitations: number;
};

/** What the panel shows: the style used and the line that says where it comes from. */
export type EffectiveStyle = {
  style: CitationStyle;
  id: StyleId;
  /** "Stil: IEEE (postavka ustanove)" only when the institution's style is in use. */
  label: string | null;
  /** Why the default FPZG style is shown instead, or null. */
  note: string | null;
};

const defaultStyle = (): CitationStyle => citationStyleOf(DEFAULT_STYLE_ID)!;

/** FPZG without a note: shown when there is no assignment to read an institution style for. */
export const defaultEffectiveStyle = (): EffectiveStyle => ({ style: defaultStyle(), id: DEFAULT_STYLE_ID, label: null, note: null });

/** Maps the three outcomes of the style read to what is shown; a failed read never changes the list to "no data". */
export function effectiveStyle(read: InstitutionStyleRead): EffectiveStyle {
  const fpzg = { style: defaultStyle(), id: DEFAULT_STYLE_ID };
  switch (read.kind) {
    case "style":
      return { style: read.style, id: read.id, label: `${citationStyleText.label}: ${styleNameOf(read.id)} (${citationStyleText.setting})`, note: null };
    case "fallback":
      return { ...fpzg, label: null, note: citationStyleText.unavailableStyle };
    case "error":
      return { ...fpzg, label: null, note: citationStyleText.readFailed };
    case "loading":
      return { ...fpzg, label: null, note: citationStyleText.loading };
  }
}

const text = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";

function person(value: unknown): boolean {
  const p = value as Record<string, unknown>;
  return typeof value === "object" && value !== null && text(p.family) && typeof p.given === "string";
}

function author(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const a = value as Record<string, unknown>;
  return a.kind === "organization" ? text(a.name) : a.kind === "person" && person(a);
}

/** The source as the formatter needs it, or null when a field it relies on is missing or of the wrong kind. */
export function toSource(raw: Record<string, unknown>): Source | null {
  if (!Array.isArray(raw.authors) || raw.authors.length === 0 || !raw.authors.every(author)) return null;
  if (typeof raw.year !== "number" || !Number.isInteger(raw.year) || !text(raw.title)) return null;
  const optional = (key: string) => raw[key] === undefined || typeof raw[key] === "string";
  const base = { authors: raw.authors, year: raw.year, title: raw.title, ...(typeof raw.yearSuffix === "string" ? { yearSuffix: raw.yearSuffix } : {}) };
  switch (raw.type) {
    case "book":
      return text(raw.place) && text(raw.publisher) ? ({ ...base, type: "book", place: raw.place, publisher: raw.publisher } as Source) : null;
    case "article":
      return text(raw.journal) && optional("volume") && optional("issue") && optional("pages")
        ? ({ ...base, type: "article", journal: raw.journal, volume: raw.volume, issue: raw.issue, pages: raw.pages } as Source) : null;
    case "chapter":
      return text(raw.bookTitle) && text(raw.place) && text(raw.publisher) && optional("pages") && Array.isArray(raw.editors) && raw.editors.every(person)
        ? ({ ...base, type: "chapter", editors: raw.editors, bookTitle: raw.bookTitle, place: raw.place, publisher: raw.publisher, pages: raw.pages } as Source) : null;
    case "web":
      return text(raw.url) && text(raw.accessed) ? ({ ...base, type: "web", url: raw.url, accessed: raw.accessed } as Source) : null;
    default:
      return null;
  }
}

type Cited = { sourceId: string; locator: string | undefined };

function citationsOf(doc: Json | null | undefined): Cited[] {
  const out: Cited[] = [];
  const walk = (node: Json) => {
    if (node.type === "citation") {
      if (typeof node.attrs?.sourceId === "string") {
        const locator = node.attrs.locator;
        out.push({ sourceId: node.attrs.sourceId, locator: typeof locator === "string" ? locator : undefined });
      }
      return;
    }
    for (const child of node.content ?? []) walk(child);
  };
  if (doc) walk(doc);
  return out;
}

const safely = <T>(run: () => T): T | null => {
  try { return run(); } catch { return null; }
};

/**
 * ED-106 (prototype copyCite): the in-text citation of one source, without a page, as "Kopiraj navod" copies it.
 * Author-date styles keep the year letter the list gives (a source not yet cited is lettered as if it were);
 * numeric styles copy the number of a cited source. Null when the source is unknown, cannot be formatted, or has
 * no number yet.
 */
export function citationToCopy(doc: Json | null | undefined, style: CitationStyle, sourceId: string): string | null {
  const rawSources = Array.isArray(doc?.attrs?.sources) ? (doc.attrs.sources as unknown[]) : [];
  const rawOf = (id: string) => rawSources.find((item): item is Record<string, unknown> =>
    typeof item === "object" && item !== null && (item as Record<string, unknown>).id === id);
  const own = rawOf(sourceId);
  const source = own ? toSource(own) : null;
  if (source === null) return null;
  const listed = styledLiterature(doc, style);
  if (style.style === "numeric") {
    const number = listed.entries.find((e) => e.sourceId === sourceId)?.number;
    return number === undefined ? null : safely(() => formatNumericCitation(number, style, undefined));
  }
  const ids = listed.entries.map((e) => e.sourceId);
  if (!ids.includes(sourceId)) ids.push(sourceId);
  const keyed = ids.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).flatMap((id) => {
    const s = id === sourceId ? source : toSource(rawOf(id) ?? {});
    return s ? [{ ...s, sourceId: id }] : [];
  });
  const lettered = assignYearSuffixes(keyed).find((s) => s.sourceId === sourceId);
  if (!lettered) return null;
  const { sourceId: _id, ...rest } = lettered;
  return safely(() => formatCitationInText(rest as Source, style, undefined));
}

/** The list and the in-text citations of a document (ProseMirror JSON) in `style`. */
export function styledLiterature(doc: Json | null | undefined, style: CitationStyle): StyledLiterature {
  const rawSources = Array.isArray(doc?.attrs?.sources) ? (doc.attrs.sources as unknown[]) : [];
  const byId = new Map<string, Record<string, unknown>>();
  for (const item of rawSources) {
    if (typeof item !== "object" || item === null) continue;
    const raw = item as Record<string, unknown>;
    if (typeof raw.id === "string" && !byId.has(raw.id)) byId.set(raw.id, raw);
  }
  const cites = citationsOf(doc);
  let orphanCitations = 0;
  const firstCited: string[] = [];
  for (const { sourceId } of cites) {
    if (!byId.has(sourceId)) orphanCitations += 1;
    else if (!firstCited.includes(sourceId)) firstCited.push(sourceId);
  }
  const formattable = new Map<string, Source>();
  const unformatted: string[] = [];
  for (const id of firstCited) {
    const source = toSource(byId.get(id)!);
    if (source && safely(() => formatBibliographyEntry(source, style)) !== null) formattable.set(id, source);
    else unformatted.push(id);
  }

  if (style.style === "numeric") {
    const numbers = new Map<string, number>();
    const entries: StyledEntry[] = [];
    for (const [sourceId, source] of formattable) {
      const number = numbers.size + 1;
      const line = safely(() => formatNumberedBibliographyEntry(number, source, style));
      if (line === null) { unformatted.push(sourceId); continue; }
      numbers.set(sourceId, number);
      entries.push({ sourceId, number, text: line });
    }
    const citations: StyledCitation[] = [];
    cites.forEach(({ sourceId, locator }, index) => {
      const number = numbers.get(sourceId);
      const line = number === undefined ? null : safely(() => formatNumericCitation(number, style, locator));
      if (line !== null) citations.push({ index, sourceId, text: line });
    });
    return { entries, citations, unformatted, orphanCitations };
  }

  // Author-date: ids are ordered first so the result does not depend on the order of citations (as deriveBibliography).
  const keyed = [...formattable].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([sourceId, source]) => ({ ...source, sourceId }));
  const ordered = sortBibliography(assignYearSuffixes(keyed));
  const withSuffix = new Map(ordered.map(({ sourceId, ...rest }) => [sourceId, rest as Source]));
  const entries: StyledEntry[] = ordered.map(({ sourceId, ...rest }) => ({ sourceId, text: formatBibliographyEntry(rest as Source, style) }));
  const citations: StyledCitation[] = [];
  cites.forEach(({ sourceId, locator }, index) => {
    const source = withSuffix.get(sourceId);
    const line = source === undefined ? null : safely(() => formatCitationInText(source, style, locator));
    if (line !== null) citations.push({ index, sourceId, text: line });
  });
  return { entries, citations, unformatted, orphanCitations };
}
