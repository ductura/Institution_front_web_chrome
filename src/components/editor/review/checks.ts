/**
 * The text checks of the Pregled card (WEB-1102, E§3.5 review2 and E§3.4
 * advice and tools). Plain checks of the text in the browser, no AI, nothing
 * sent anywhere: the findings are made here from the open document and only
 * the list of enabled check ids comes from the server.
 *
 * Every finding is advice ("za pogledati") except `hole`, the marks the
 * student left for later ([?], [izvor]); the review itself blocks nothing.
 * Findings carry no index: the id is the kind, the block and the place in it,
 * and `key` (kind and the first 40 characters) is what "nije greška" keeps.
 */

import { CITATION_MARK, wordCount, type ReviewBlock, type ReviewDoc } from "./model";

export const CHECK_IDS = ["hole", "num", "long", "colloq", "absolute", "first", "passive", "short", "fix", "ref", "str"] as const;
export type CheckId = (typeof CHECK_IDS)[number];

export type Finding = {
  readonly id: string;
  readonly kind: CheckId;
  /** Advice, except a mark left for later. */
  readonly severity: "required" | "advisory";
  /** The block the finding is in; where to jump. */
  readonly block: number;
  readonly blockId: string | null;
  readonly pos: number;
  readonly chapter: number;
  /** The words of the text the finding is about, shortened. */
  readonly excerpt: string;
  /** What exactly was found (a number, a word, a count); empty when the kind says it all. */
  readonly note: string;
  /** Kind and the first 40 characters of the excerpt: what "nije greška" remembers. */
  readonly key: string;
};

/** The ids this build knows from the ones the server sent, in the server's order. */
export function knownCheckIds(ids: readonly string[]): CheckId[] {
  return ids.filter((id): id is CheckId => (CHECK_IDS as readonly string[]).includes(id));
}

const L = String.raw`\p{L}`;
const word = (alternatives: string) => new RegExp(String.raw`(?<!${L})(?:${alternatives})(?!${L})`, "giu");

const LONG_SENTENCE_WORDS = 40;
const SHORT_PARAGRAPH_WORDS = 15;
const PASSIVE_RUN = 3;

const HOLE = /\[(?:\?|izvor|provjeri|broj|stranica|citat)[^\]]{0,40}\]/giu;
const COLLOQUIAL = word("super|kul|fora|ludo|tipa|nekako|onako|svašta|uglavnom|znači|i slično|i tako dalje");
const ABSOLUTE = word("uvijek|nikada|nikad|nitko|nepobitno|nedvojbeno|apsolutno|očito|bez iznimke|svaki put");
const FIRST_PERSON = word("ja|mi|moj|moja|moje|moju|moji|naš|naša|naše|našu|smatram|mislim|vjerujem|držim");
const PASSIVE = new RegExp(String.raw`(?<!${L})(?:je|su|bio|bila|bilo|bili|bude|budu)\s+${L}{3,}[nt][aeio]?(?!${L})`, "iu");
const NUMBER = new RegExp(
  String.raw`\d+(?:[.,]\d+)?\s*(?:%|posto|eura?|EUR|€|kn|kuna|milijun|milijard|tisuć)|\d{1,3}(?:[.  ]\d{3})+|\d+\s+(?:stanovnik|radnik|zaposlen|ljudi|osob|ispitanik|student)`,
  "iu",
);
const CHAPTER_REF = /poglavlj[a-zčćžšđ]*\s+(\d+(?:\.\d+)*)/giu;
const NEXT_REF = /u\s+(?:sljedeć|idu[ćc])[a-zčćžšđ]*\s+poglavlj/iu;
const PREV_REF = /u\s+(?:prethodn|prošl)[a-zčćžšđ]*\s+poglavlj/iu;

/** Sentences of a text, without trimming marks; empty ones dropped. */
export function sentencesOf(text: string): string[] {
  return text.split(/(?<=[.!?…])\s+(?=[A-ZČĆŽŠĐ„"(\d[])/u).map((s) => s.trim()).filter((s) => s !== "");
}

const shorten = (text: string, max = 80) => {
  const flat = text.replaceAll(CITATION_MARK, "").replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

type Hit = { readonly excerpt: string; readonly note?: string };

const hasSource = (sentence: string, next: string | undefined) =>
  sentence.includes(CITATION_MARK) || /\([^()]*\d{4}[^()]*\)/u.test(sentence) || (next !== undefined && /^(?:isto|ibid)/iu.test(next));

function matches(text: string, pattern: RegExp): Hit[] {
  return [...text.matchAll(pattern)].map((m) => ({ excerpt: shorten(text.slice(Math.max(0, m.index - 20), m.index + m[0].length + 20)), note: m[0] }));
}

const BLOCK_CHECKS: Readonly<Partial<Record<CheckId, (block: ReviewBlock) => Hit[]>>> = {
  hole: (block) => matches(block.text, HOLE),
  num: (block) => {
    if (block.kind === "quote") return [];
    const sentences = sentencesOf(block.text);
    return sentences.flatMap((sentence, i) => {
      const found = NUMBER.exec(sentence);
      return found && !hasSource(sentence, sentences[i + 1]) ? [{ excerpt: shorten(sentence), note: found[0] }] : [];
    });
  },
  long: (block) => sentencesOf(block.text).filter((s) => wordCount(s) > LONG_SENTENCE_WORDS)
    .map((s) => ({ excerpt: shorten(s), note: String(wordCount(s)) })),
  colloq: (block) => (block.kind === "quote" ? [] : matches(block.text, COLLOQUIAL)),
  absolute: (block) => (block.kind === "quote" ? [] : matches(block.text, ABSOLUTE)),
  first: (block) => (block.kind === "quote" ? [] : matches(block.text, FIRST_PERSON)),
  passive: (block) => {
    const sentences = sentencesOf(block.text);
    const hits: Hit[] = [];
    let run = 0;
    sentences.forEach((sentence, i) => {
      run = PASSIVE.test(sentence) ? run + 1 : 0;
      if (run === PASSIVE_RUN) hits.push({ excerpt: shorten(sentences[i - PASSIVE_RUN + 1]!), note: String(PASSIVE_RUN) });
    });
    return hits;
  },
  short: (block) => block.kind === "paragraph" && block.text.trim() !== "" && wordCount(block.text) < SHORT_PARAGRAPH_WORDS
    ? [{ excerpt: shorten(block.text), note: String(wordCount(block.text)) }] : [],
  fix: (block) => {
    if (block.kind === "quote") return [];
    const t = block.text;
    const hits: Hit[] = [];
    const add = (pattern: RegExp, note: string) => { if (pattern.test(t)) hits.push({ excerpt: shorten(t), note }); };
    add(/(?<=\S) {2,}(?=\S)/u, "spaces");
    add(/ [,;:.!?](?!\.)/u, "before");
    add(/[,;:](?=\p{L})/u, "after");
    add(/"/u, "quotes");
    add(/,,|;;|(?<!\.)\.\.(?!\.)|!!|\?\?/u, "double");
    return hits;
  },
};

/** Chapter references and the structure of headings read the chapters, not one block. */
function documentChecks(doc: ReviewDoc, enabled: ReadonlySet<CheckId>): { kind: CheckId; block: number; hit: Hit }[] {
  const out: { kind: CheckId; block: number; hit: Hit }[] = [];
  const numbers = new Set(doc.chapters.map((chapter) => chapter.number));
  if (enabled.has("ref")) {
    doc.blocks.forEach((block, index) => {
      if (block.kind === "heading" || block.text === "") return;
      for (const m of block.text.matchAll(CHAPTER_REF)) {
        if (!numbers.has(m[1]!)) out.push({ kind: "ref", block: index, hit: { excerpt: shorten(m[0]), note: `missing:${m[1]}` } });
      }
      const last = block.chapter === doc.chapters.length - 1;
      const first = block.chapter <= 0;
      if (NEXT_REF.test(block.text) && last) out.push({ kind: "ref", block: index, hit: { excerpt: shorten(block.text), note: "last" } });
      if (PREV_REF.test(block.text) && first) out.push({ kind: "ref", block: index, hit: { excerpt: shorten(block.text), note: "first" } });
    });
  }
  if (enabled.has("str")) {
    doc.chapters.forEach((chapter) => {
      const own = doc.blocks.slice(chapter.block + 1, chapter.end);
      if (own.every((block) => wordCount(block.text) === 0)) {
        out.push({ kind: "str", block: chapter.block, hit: { excerpt: shorten(chapter.title), note: "empty" } });
      }
      const children = doc.chapters.filter((c) => c.block > chapter.block && c.block < chapter.end && c.level === chapter.level + 1);
      if (children.length === 1) out.push({ kind: "str", block: chapter.block, hit: { excerpt: shorten(chapter.title), note: "single" } });
      if (chapter.title.length > 90) out.push({ kind: "str", block: chapter.block, hit: { excerpt: shorten(chapter.title), note: "long" } });
      if (/[.:]$/u.test(chapter.title)) out.push({ kind: "str", block: chapter.block, hit: { excerpt: shorten(chapter.title), note: "punct" } });
    });
  }
  return out;
}

/**
 * Every finding of the document for the enabled checks, in document order.
 * `enabled` is the list the server sent; unknown ids are dropped, and `null`
 * (no list yet or none readable) runs every check this build has.
 */
export function runChecks(doc: ReviewDoc, enabled: readonly string[] | null): Finding[] {
  const kinds = new Set<CheckId>(enabled === null ? CHECK_IDS : knownCheckIds(enabled));
  const raw: { kind: CheckId; block: number; hit: Hit }[] = [];
  doc.blocks.forEach((block, index) => {
    if (block.text === "") return;
    for (const kind of CHECK_IDS) {
      const check = BLOCK_CHECKS[kind];
      if (!check || !kinds.has(kind)) continue;
      // The headings are read by `str` and `ref` only; the sentence checks are for the text.
      if (block.kind === "heading") continue;
      for (const hit of check(block)) raw.push({ kind, block: index, hit });
    }
  });
  raw.push(...documentChecks(doc, kinds));
  raw.sort((a, b) => a.block - b.block || CHECK_IDS.indexOf(a.kind) - CHECK_IDS.indexOf(b.kind));

  const seen = new Map<string, number>();
  return raw.map(({ kind, block: index, hit }) => {
    const block = doc.blocks[index]!;
    const base = `${kind}:${block.id ?? `p${block.pos}`}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return {
      id: `${base}:${n}`, kind, severity: kind === "hole" ? "required" : "advisory", block: index, blockId: block.id,
      pos: block.pos, chapter: block.chapter, excerpt: hit.excerpt, note: hit.note ?? "", key: `${kind}|${hit.excerpt.slice(0, 40)}`,
    };
  });
}
