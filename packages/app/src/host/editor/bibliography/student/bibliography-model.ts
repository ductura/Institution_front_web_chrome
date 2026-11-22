/**
 * What the student's bibliography panel shows, derived from the document JSON
 * (INVENTAR-editor §2.4 tools.js): where each source is cited, the chapter
 * that leans on one source, incomplete and doubled sources and the overview of
 * the literature. Pure functions; the document is read, never written.
 */
import { bibliographyStudentHr as t } from "./messages.hr";

type Json = { type?: unknown; attrs?: Record<string, unknown>; content?: readonly Json[]; text?: unknown };

export type BibSource = {
  id: string;
  label: string;
  type: string;
  title: string;
  raw: Record<string, unknown>;
};
export type CitePlace = {
  /** Order of the citation in the text, from 0. */
  index: number;
  sourceId: string;
  page: string | null;
  /** Number of the chapter ("2", "2.1") or null before the first heading. */
  chapter: string | null;
  sentence: string;
};
export type SourceStat = BibSource & { places: CitePlace[]; proofs: number };

const fold = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").replaceAll("đ", "d").toLocaleLowerCase("hr");

function authorName(author: unknown): string {
  const a = (typeof author === "object" && author !== null ? author : {}) as Record<string, unknown>;
  if (a.kind === "organization" && typeof a.name === "string") return typeof a.acronym === "string" && a.acronym ? a.acronym : a.name;
  return typeof a.family === "string" ? a.family : "";
}

export function bibSourceLabel(source: Record<string, unknown>): string {
  const names = (Array.isArray(source.authors) ? source.authors : []).map(authorName).filter(Boolean);
  const who = names.length === 0 ? String(source.title ?? "") : names.length === 1 ? names[0]!
    : names.length === 2 ? `${names[0]} i ${names[1]}` : `${names[0]} i sur.`;
  return typeof source.year === "number" ? `${who} (${source.year})` : who;
}

export function bibSources(doc: Json | null | undefined): BibSource[] {
  const list = doc?.attrs?.sources;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: BibSource[] = [];
  for (const item of list) {
    if (typeof item !== "object" || item === null) continue;
    const raw = item as Record<string, unknown>;
    if (typeof raw.id !== "string" || seen.has(raw.id)) continue;
    seen.add(raw.id);
    out.push({ id: raw.id, label: bibSourceLabel(raw), type: String(raw.type ?? ""), title: String(raw.title ?? ""), raw });
  }
  return out;
}

function plain(node: Json): string {
  if (typeof node.text === "string") return node.text;
  if (node.type === "citation") return "(…)";
  return (node.content ?? []).map(plain).join("");
}

const SENTENCE_MAX = 210;

/** Every citation in text order, with its chapter number and the sentence it stands in. */
export function citePlaces(doc: Json | null | undefined): CitePlace[] {
  const out: CitePlace[] = [];
  const counters = [0, 0, 0];
  let chapter: string | null = null;
  const block = (node: Json) => {
    if (node.type === "heading") {
      const level = Math.min(3, Math.max(1, Number(node.attrs?.level) || 1));
      counters[level - 1] = (counters[level - 1] ?? 0) + 1;
      for (let i = level; i < 3; i += 1) counters[i] = 0;
      chapter = counters.slice(0, level).join(".");
      return;
    }
    const children = node.content ?? [];
    if (children.some((c) => c.type === "citation")) {
      const text = plain(node).replace(/\s+/gu, " ").trim();
      const sentence = text.length > SENTENCE_MAX ? `${text.slice(0, SENTENCE_MAX - 1)}…` : text;
      for (const child of children) {
        if (child.type !== "citation" || typeof child.attrs?.sourceId !== "string") continue;
        const locator = child.attrs.locator;
        out.push({
          index: out.length, sourceId: child.attrs.sourceId, chapter, sentence,
          page: typeof locator === "string" && locator.trim() ? locator : null,
        });
      }
    } else for (const child of children) block(child);
  };
  for (const node of doc?.content ?? []) block(node);
  return out;
}

export function sourceStats(sources: readonly BibSource[], places: readonly CitePlace[], proofsBySource: ReadonlyMap<string, number>): SourceStat[] {
  return sources.map((s) => ({ ...s, places: places.filter((p) => p.sourceId === s.id), proofs: proofsBySource.get(s.id) ?? 0 }));
}

export type Reliance = { chapter: string; source: BibSource; count: number; total: number; firstIndex: number };

/** Chapters with at least five citations where one source gives half or more of them. */
export function relianceNotes(sources: readonly BibSource[], places: readonly CitePlace[]): Reliance[] {
  const byChapter = new Map<string, CitePlace[]>();
  for (const p of places) if (p.chapter) byChapter.set(p.chapter, [...(byChapter.get(p.chapter) ?? []), p]);
  const out: Reliance[] = [];
  for (const [chapter, list] of byChapter) {
    if (list.length < 5) continue;
    const counts = new Map<string, number>();
    for (const p of list) counts.set(p.sourceId, (counts.get(p.sourceId) ?? 0) + 1);
    const best = [...counts].sort((a, b) => b[1] - a[1])[0];
    if (!best) continue;
    const [id, count] = best;
    const source = sources.find((s) => s.id === id);
    if (source && count * 2 >= list.length) {
      out.push({ chapter, source, count, total: list.length, firstIndex: list.find((p) => p.sourceId === id)!.index });
    }
  }
  return out;
}

const REQUIRED: Record<string, readonly [string, string][]> = {
  book: [["place", t.fieldPlace], ["publisher", t.fieldPublisher]],
  article: [["journal", t.fieldJournal]],
  chapter: [["bookTitle", t.fieldBookTitle], ["place", t.fieldPlace], ["publisher", t.fieldPublisher]],
  web: [["url", t.fieldUrl], ["accessed", t.fieldAccessed]],
};

/** Names of the required fields that are empty (prototype "nedostaje: …"). */
export function missingFields(source: Record<string, unknown>): string[] {
  const empty = (key: string) => {
    const v = source[key];
    return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
  };
  const out: string[] = [];
  if (!Array.isArray(source.authors) || source.authors.length === 0) out.push(t.fieldAuthor);
  if (empty("year")) out.push(t.fieldYear);
  if (empty("title")) out.push(t.fieldTitle);
  for (const [key, name] of REQUIRED[String(source.type)] ?? []) if (empty(key)) out.push(name);
  return out;
}

/** Sources with the same normalised title (first 40 characters), the later one pointing at the earlier. */
export function possibleDuplicates(sources: readonly BibSource[]): { source: BibSource; of: BibSource }[] {
  const seen = new Map<string, BibSource>();
  const out: { source: BibSource; of: BibSource }[] = [];
  for (const source of sources) {
    const key = fold(source.title).replace(/[^\p{L}\p{N}]+/gu, " ").trim().slice(0, 40);
    if (!key) continue;
    const first = seen.get(key);
    if (first) out.push({ source, of: first }); else seen.set(key, source);
  }
  return out;
}

export function typeName(type: string): string {
  return ({ book: t.typeBook, article: t.typeArticle, chapter: t.typeChapter, web: t.typeWeb } as Record<string, string>)[type] ?? type;
}

export function overviewRows(stats: readonly SourceStat[]) {
  return stats.map((s) => ({ id: s.id, label: s.label, kind: typeName(s.type), cites: s.places.length, proofs: s.proofs }));
}
