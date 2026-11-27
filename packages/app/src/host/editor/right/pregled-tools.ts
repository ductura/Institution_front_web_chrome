// ED-74 (paritet s prototipom, desni panel, grupa „Pregled”): Šavovi, Ponavljanja,
// Dosljednost, Brojke bez izvora i Doslovni navodi (prototype tools.js RP.PRE.sav/pon/dos,
// review2.js PRE.num/quo; INVENTAR §2.4 and §2.5). Plain checks of the review model of the
// open document: nothing here changes the work or leaves the browser. Invented text only in the tests.
import { CITATION_MARK, wordCount, type ReviewBlock, type ReviewDoc } from "../../../../../../src/components/editor/review/model";
import { runChecks, sentencesOf } from "../../../../../../src/components/editor/review/checks";
import { scopeRange, type PregledScope } from "./pregled-model";

const clean = (text: string) => text.replaceAll(CITATION_MARK, "").replace(/\s+/g, " ").trim();
const cut = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

const blocksIn = (doc: ReviewDoc, scope: PregledScope): ReviewBlock[] => {
  const { first, end } = scopeRange(doc, scope);
  return doc.blocks.slice(first, end);
};
const paragraphsIn = (doc: ReviewDoc, scope: PregledScope) => blocksIn(doc, scope).filter((b) => b.kind === "paragraph" && clean(b.text) !== "");
const textBlocksIn = (doc: ReviewDoc, scope: PregledScope) => blocksIn(doc, scope).filter((b) => b.kind !== "heading" && b.text.trim() !== "");

/* ================= Šavovi ================= */

export type SeamSide = { readonly chapter: string; readonly sentence: string | null; readonly pos: number | null };
export type Seam = { readonly key: string; readonly end: SeamSide; readonly start: SeamSide };

const SEAM_CUT = 260;

/** The top chapter (level 1) a chapter index belongs to, -1 when there is none. */
function topOf(doc: ReviewDoc, index: number): number {
  for (let i = Math.min(index, doc.chapters.length - 1); i >= 0; i -= 1) if (doc.chapters[i]!.level === 1) return i;
  return -1;
}

/**
 * The end of one chapter and the start of the next, for every two neighbouring top chapters;
 * in the scope of a chapter only the seams on either side of its top chapter.
 */
export function seams(doc: ReviewDoc, scope: PregledScope): Seam[] {
  const tops = doc.chapters.map((c, i) => ({ c, i })).filter((x) => x.c.level === 1);
  const focus = scope.kind === "chapter" ? topOf(doc, scope.index) : -1;
  const label = (i: number) => { const c = doc.chapters[i]!; return `${c.number}. ${c.title}`; };
  const paras = (i: number) => { const c = doc.chapters[i]!; return doc.blocks.slice(c.block + 1, c.end).filter((b) => b.kind === "paragraph" && clean(b.text) !== ""); };
  const side = (i: number, which: "end" | "start"): SeamSide => {
    const list = paras(i);
    const block = which === "end" ? list[list.length - 1] : list[0];
    if (!block) return { chapter: label(i), sentence: null, pos: null };
    const sentences = sentencesOf(block.text).map(clean).filter((s) => s !== "");
    const sentence = which === "end" ? sentences[sentences.length - 1] : sentences[0];
    return { chapter: label(i), sentence: sentence ? cut(sentence, SEAM_CUT) : null, pos: block.pos };
  };
  const out: Seam[] = [];
  tops.forEach((a, k) => {
    const b = tops[k + 1];
    if (!b || (focus >= 0 && a.i !== focus && b.i !== focus)) return;
    out.push({ key: `${a.i}-${b.i}`, end: side(a.i, "end"), start: side(b.i, "start") });
  });
  return out;
}

/* ================= Ponavljanja ================= */

const STOP = new Set("između također kojima odnosno međutim prema tijekom nakon kroz koji koja koje kojih kojem kako može mogu bila bilo bili biti nije samo više svoj svoje ovog toga jedan jedna godine godina nego ali već kada kao zbog ovaj ovom time tako stoga čime čiji čija njegov njihov prije poslije unutar tome ovdje jest jesu bismo budući pritom dakle iako".split(" "));
const STARTS_MIN = 3;
const STARTS_SHOWN = 8;
const WORDS_MIN = 6;
const WORDS_SHOWN = 12;
const WORD_KEY = 6;

export type SentenceStart = { readonly word: string; readonly count: number; readonly pos: number };
export type RepeatedWord = { readonly word: string; readonly key: string; readonly count: number };

const top = <T extends { count: number }>(list: T[], min: number, max: number) => list.filter((x) => x.count >= min).sort((a, b) => b.count - a.count).slice(0, max);

/** Sentence starts (a first word of three letters or more) used three times or more, at most eight. */
export function sentenceStarts(doc: ReviewDoc, scope: PregledScope): SentenceStart[] {
  const seen = new Map<string, { word: string; count: number; pos: number }>();
  for (const block of paragraphsIn(doc, scope)) {
    for (const sentence of sentencesOf(clean(block.text))) {
      const m = /^[„"(]?(\p{L}{3,})/u.exec(sentence);
      if (!m) continue;
      const o = seen.get(m[1]!) ?? { word: m[1]!, count: 0, pos: block.pos };
      o.count += 1;
      seen.set(m[1]!, o);
    }
  }
  return top([...seen.values()], STARTS_MIN, STARTS_SHOWN);
}

/** Words of five letters or more (counted by their first six letters) used six times or more, at most twelve. */
export function repeatedWords(doc: ReviewDoc, scope: PregledScope): RepeatedWord[] {
  const seen = new Map<string, { word: string; key: string; count: number }>();
  for (const block of textBlocksIn(doc, scope)) {
    for (const m of block.text.matchAll(/\p{L}{5,}/gu)) {
      const w = m[0].toLocaleLowerCase("hr");
      if (STOP.has(w)) continue;
      const key = w.slice(0, WORD_KEY);
      const o = seen.get(key) ?? { word: w, key, count: 0 };
      o.count += 1;
      seen.set(key, o);
    }
  }
  return top([...seen.values()], WORDS_MIN, WORDS_SHOWN);
}

/** The block of the next use of a word after `from` (the first use when none follows), or null. */
export function nextUse(doc: ReviewDoc, key: string, from: number): number | null {
  const re = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "iu");
  const hits = doc.blocks.filter((b) => b.kind !== "heading" && re.test(b.text)).map((b) => b.pos);
  return hits.find((pos) => pos > from) ?? hits[0] ?? null;
}

/* ================= Dosljednost ================= */

type Category = { readonly name: string; readonly pattern: RegExp; readonly form: (m: RegExpMatchArray) => string };

const CATEGORIES: readonly Category[] = [
  { name: "Razdoblja", pattern: /\b\d{4}(\.?)(\s?)([-–—])(\s?)(\d{4}|\d{2})(\.?)(?!\d)/g, form: (m) => `1941${m[1]}${m[2]}${m[3]}${m[4]}${m[5]!.length === 2 ? "47" : "1947"}${m[6]}` },
  { name: "Tisućice", pattern: /\b\d{1,3}([. ])\d{3}\b(?![.,]?\d)|\b[1-9]\d{4,}\b/g, form: (m) => (m[1] === "." ? "10.000" : m[1] === " " ? "10 000" : "10000") },
  { name: "Postotak", pattern: /\d(\s?)(%|posto)/g, form: (m) => (m[2] === "posto" ? "5 posto" : `5${m[1]}%`) },
  { name: "Desetljeća", pattern: /\b(\d{4}|\d{2})-(ih|e|tih)\b/g, form: (m) => `${m[1]!.length === 4 ? "1980" : "80"}-${m[2]}` },
  { name: "Navodnici", pattern: /[„“"«»]/g, form: (m) => ({ "„": "„ ”", "“": "“ ”", '"': '" "', "«": "« »", "»": "» «" })[m[0]] ?? m[0] },
];

export type Form = { readonly form: string; readonly count: number; readonly pos: number };
export type Inconsistency = { readonly name: string; readonly forms: readonly Form[] };

/** Categories written in more than one way in scope, and the names of those written one way. */
export function consistency(doc: ReviewDoc, scope: PregledScope): { mixed: Inconsistency[]; consistent: string[] } {
  const blocks = textBlocksIn(doc, scope);
  const mixed: Inconsistency[] = [];
  const consistent: string[] = [];
  for (const { name, pattern, form } of CATEGORIES) {
    const seen = new Map<string, { form: string; count: number; pos: number }>();
    for (const block of blocks) {
      for (const m of block.text.matchAll(pattern)) {
        const k = form(m);
        const o = seen.get(k) ?? { form: k, count: 0, pos: block.pos };
        o.count += 1;
        seen.set(k, o);
      }
    }
    const forms = [...seen.values()].sort((a, b) => b.count - a.count);
    if (forms.length > 1) mixed.push({ name, forms }); else consistent.push(name.toLocaleLowerCase("hr"));
  }
  return { mixed, consistent };
}

/* ================= Brojke bez izvora ================= */

export type NumberRow = { readonly key: string; readonly number: string; readonly sentence: string; readonly pos: number };

/** Sentences with a number and no citation: the `num` check of Provjere, limited to the scope. */
export function numbersWithoutSource(doc: ReviewDoc, scope: PregledScope): NumberRow[] {
  const { first, end } = scopeRange(doc, scope);
  return runChecks(doc, ["num"]).filter((f) => f.block >= first && f.block < end)
    .map((f) => ({ key: f.id, number: f.note, sentence: f.excerpt, pos: f.pos }));
}

/* ================= Doslovni navodi ================= */

export const LONG_QUOTE_WORDS = 40;
const QUOTE_CUT = 150;
const LONGEST_SHOWN = 8;

export type QuoteRow = { readonly key: string; readonly text: string; readonly words: number; readonly block: boolean; readonly pos: number };
export type QuoteSummary = { readonly list: readonly QuoteRow[]; readonly long: readonly QuoteRow[]; readonly longest: readonly QuoteRow[]; readonly total: number; readonly quoted: number };

/** Quotations in scope: whole quote blocks and words in quotation marks inside paragraphs. */
export function quotations(doc: ReviewDoc, scope: PregledScope): QuoteSummary {
  const list: QuoteRow[] = [];
  let total = 0;
  for (const block of blocksIn(doc, scope)) {
    if (block.kind !== "paragraph" && block.kind !== "quote") continue;
    const text = clean(block.text);
    if (text === "") continue;
    total += wordCount(text);
    if (block.kind === "quote") { list.push({ key: `${block.pos}`, text: cut(text, QUOTE_CUT), words: wordCount(text), block: true, pos: block.pos }); continue; }
    let n = 0;
    for (const m of text.matchAll(/[„“"]([^„”“"]{3,})[”“"]/g)) {
      list.push({ key: `${block.pos}:${n}`, text: cut(m[1]!, QUOTE_CUT), words: wordCount(m[1]!), block: false, pos: block.pos });
      n += 1;
    }
  }
  list.sort((a, b) => b.words - a.words);
  return {
    list, long: list.filter((q) => q.words > LONG_QUOTE_WORDS && !q.block), longest: list.slice(0, LONGEST_SHOWN),
    total, quoted: list.reduce((s, q) => s + q.words, 0),
  };
}
