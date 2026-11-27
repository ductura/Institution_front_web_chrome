// WEB-2127: the Pregled group as data. Reads only the review model of the open
// document (src/components/editor/review/model.ts); nothing here changes the
// work or leaves the browser. Invented text only in the tests.
import { CITATION_MARK, wordCount, type ReviewDoc } from "../../../../../../src/components/editor/review/model";
import { sentencesOf } from "../../../../../../src/components/editor/review/checks";

export type PregledScope = { readonly kind: "work" } | { readonly kind: "chapter"; readonly index: number };
export const WHOLE: PregledScope = { kind: "work" };

export const LONG_FIRST_SENTENCE_WORDS = 35;
export const MAX_TERMS = 200;
export const MAX_TERM_LENGTH = 80;
export const MAX_DEFINITION_LENGTH = 500;
const FREQUENT_MIN_LETTERS = 5;
const FREQUENT_MIN_COUNT = 3;
const FREQUENT_SHOWN = 8;

/** Index of the chapter the block at `pos` belongs to, -1 before the first heading. */
export function chapterAt(doc: ReviewDoc, pos: number): number {
  let at = -1;
  for (const block of doc.blocks) { if (block.pos <= pos) at = block.chapter; else break; }
  return at;
}

/** Blocks [first, end) of the scope; a chapter runs with its subchapters. */
export function scopeRange(doc: ReviewDoc, scope: PregledScope): { first: number; end: number } {
  if (scope.kind === "work") return { first: 0, end: doc.blocks.length };
  const chapter = doc.chapters[scope.index];
  return chapter ? { first: chapter.block, end: chapter.end } : { first: 0, end: doc.blocks.length };
}

const clean = (text: string) => text.replaceAll(CITATION_MARK, "").replace(/\s+/g, " ").trim();

// ED-72 (prototip right.js firstLines, „Obrnuti nacrt”): what a paragraph shows under its first sentence.
export const SHOWN_SENTENCE_CHARS = 200;
export const NO_CITATIONS_WORDS = 60;
export const ONE_SENTENCE_WORDS = 12;
export const LONG_PARAGRAPH_WORDS = 250;

export type OutlineFlag = "noCitations" | "oneSentence" | "longParagraph";

export type OutlineRow = {
  readonly key: string;
  readonly chapter: string | null;
  readonly sentence: string;
  /** The sentence as listed: past 200 characters cut to 197 and "…". */
  readonly shown: string;
  readonly words: number;
  readonly long: boolean;
  /** Words and citations of the whole paragraph. */
  readonly paragraphWords: number;
  readonly citations: number;
  readonly flags: readonly OutlineFlag[];
  readonly pos: number;
};

/** The paragraph's own warnings, in the prototype's order. */
export function outlineFlags(paragraphWords: number, citations: number, sentences: number): OutlineFlag[] {
  const flags: OutlineFlag[] = [];
  if (citations === 0 && paragraphWords > NO_CITATIONS_WORDS) flags.push("noCitations");
  if (sentences <= 1 && paragraphWords > ONE_SENTENCE_WORDS) flags.push("oneSentence");
  if (paragraphWords > LONG_PARAGRAPH_WORDS) flags.push("longParagraph");
  return flags;
}

/** The first sentence of every paragraph in scope; a chapter title opens its rows. */
export function outlineRows(doc: ReviewDoc, scope: PregledScope): OutlineRow[] {
  const { first, end } = scopeRange(doc, scope);
  const rows: OutlineRow[] = [];
  for (const block of doc.blocks.slice(first, end)) {
    if (block.kind !== "paragraph") continue;
    const sentences = sentencesOf(block.text).filter((s) => clean(s) !== "");
    const sentence = clean(sentences[0] ?? "");
    if (sentence === "") continue;
    const chapter = doc.chapters[block.chapter];
    const words = wordCount(sentence);
    const paragraphWords = wordCount(clean(block.text));
    rows.push({
      key: `${block.pos}`, chapter: chapter ? `${chapter.number}. ${chapter.title}` : null,
      sentence,
      shown: sentence.length > SHOWN_SENTENCE_CHARS ? `${sentence.slice(0, SHOWN_SENTENCE_CHARS - 3)}…` : sentence,
      words, long: words > LONG_FIRST_SENTENCE_WORDS,
      paragraphWords, citations: block.citations,
      flags: outlineFlags(paragraphWords, block.citations, sentences.length),
      pos: block.pos,
    });
  }
  return rows;
}

/** What "Poslušaj" reads: the text of the paragraphs in scope, citations left out. */
export function listenText(doc: ReviewDoc, scope: PregledScope): string {
  const { first, end } = scopeRange(doc, scope);
  return doc.blocks.slice(first, end).filter((b) => b.kind === "paragraph" || b.kind === "heading" || b.kind === "quote")
    .map((b) => clean(b.text)).filter((t) => t !== "").join("\n");
}

const textInScope = (doc: ReviewDoc, scope: PregledScope) => {
  const { first, end } = scopeRange(doc, scope);
  return doc.blocks.slice(first, end).filter((b) => b.kind !== "heading").map((b) => b.text.replaceAll(CITATION_MARK, " ")).join("\n");
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Occurrences of a term as a whole word (case-insensitive; an abbreviation as written). */
export function termCount(text: string, term: string): number {
  const t = term.trim();
  if (t === "") return 0;
  const re = new RegExp(String.raw`(?<![\p{L}\p{N}])${escape(t)}(?![\p{L}\p{N}])`, /^[\p{Lu}\p{N}]{2,}$/u.test(t) ? "gu" : "giu");
  return (text.match(re) ?? []).length;
}

export function termCounts(doc: ReviewDoc, scope: PregledScope, terms: readonly string[]): Record<string, number> {
  const text = textInScope(doc, scope);
  return Object.fromEntries(terms.map((t) => [t, termCount(text, t)]));
}

const STOP = new Set(["koji", "koja", "koje", "kojih", "kojim", "tijekom", "unutar", "između", "također", "mogu", "može", "kako", "njihov", "njihova", "njegov", "svoje", "prema", "ovaj", "ovaj", "tijekom", "kroz", "jedan", "jedna", "samo", "nakon", "prije", "jesu", "bude", "budu", "treba"]);

/** The words most often used in scope: at least five letters, three times, not a stop word. */
export function frequentWords(doc: ReviewDoc, scope: PregledScope): { word: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const m of textInScope(doc, scope).toLocaleLowerCase("hr").matchAll(/\p{L}+/gu)) {
    if (m[0].length < FREQUENT_MIN_LETTERS || STOP.has(m[0])) continue;
    counts.set(m[0], (counts.get(m[0]) ?? 0) + 1);
  }
  return [...counts].filter(([, n]) => n >= FREQUENT_MIN_COUNT).map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word, "hr")).slice(0, FREQUENT_SHOWN);
}

/** Abbreviations: two to six capitals (digits allowed after the first letter) written as a word. */
export function abbreviations(doc: ReviewDoc, scope: PregledScope): { abbreviation: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const m of textInScope(doc, scope).matchAll(/(?<![\p{L}\p{N}])\p{Lu}[\p{Lu}\p{N}]{1,5}(?![\p{L}\p{N}])/gu)) {
    if (/^\d/u.test(m[0]) || /^[IVXLC]+$/u.test(m[0])) continue; // roman numerals are not abbreviations
    counts.set(m[0], (counts.get(m[0]) ?? 0) + 1);
  }
  return [...counts].map(([abbreviation, count]) => ({ abbreviation, count })).sort((a, b) => b.count - a.count || a.abbreviation.localeCompare(b.abbreviation, "hr"));
}

// The glossary is the student's own list, kept beside the work in this browser.
export type Term = { readonly term: string; readonly definition: string };
export type TermStorage = Pick<Storage, "getItem" | "setItem">;
export const termsKey = (workId: string) => `ductura.editor.glossary:${workId}`;

export function loadTerms(storage: TermStorage | null, workId: string): Term[] {
  if (!storage) return [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(termsKey(workId)) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((x): Term[] => {
      const o = x as { term?: unknown; definition?: unknown };
      return typeof o?.term === "string" && typeof o.definition === "string" && o.term.trim() !== ""
        ? [{ term: o.term.slice(0, MAX_TERM_LENGTH), definition: o.definition.slice(0, MAX_DEFINITION_LENGTH) }] : [];
    }).slice(0, MAX_TERMS);
  } catch { return []; }
}

export function saveTerms(storage: TermStorage | null, workId: string, terms: readonly Term[]): boolean {
  if (!storage) return false;
  try { storage.setItem(termsKey(workId), JSON.stringify(terms)); return true; } catch { return false; }
}

export type AddResult = { readonly ok: true; readonly terms: Term[] } | { readonly ok: false; readonly reason: "empty" | "duplicate" | "full" };

export function addTerm(terms: readonly Term[], term: string, definition: string): AddResult {
  const t = term.trim().slice(0, MAX_TERM_LENGTH);
  if (t === "") return { ok: false, reason: "empty" };
  if (terms.some((x) => x.term.toLocaleLowerCase("hr") === t.toLocaleLowerCase("hr"))) return { ok: false, reason: "duplicate" };
  if (terms.length >= MAX_TERMS) return { ok: false, reason: "full" };
  return { ok: true, terms: [...terms, { term: t, definition: definition.trim().slice(0, MAX_DEFINITION_LENGTH) }] };
}

export const removeTerm = (terms: readonly Term[], term: string): Term[] => terms.filter((x) => x.term !== term);
