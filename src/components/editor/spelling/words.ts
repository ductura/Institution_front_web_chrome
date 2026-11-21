/**
 * Which words the spelling check points at (E§3.6 rich, WEB-1104). Pure text
 * logic ported from the prototype: no DOM, no dictionary file, so every rule
 * is unit-tested with a stand-in checker.
 */

export type Speller = {
  correct(word: string): boolean;
  suggest(word: string): string[];
};

/** A word inside one text block: offsets are character offsets in that block. */
export type Hit = { from: number; to: number; word: string };

/** A range of the block that the check skips (foreign-language text, links). */
export type Skip = readonly [from: number, to: number];

export type ScanContext = {
  speller: Pick<Speller, "correct">;
  /** The student's own dictionary and the words ignored in this work. */
  known: ReadonlySet<string>;
  /** Author names from the sources and terms from the glossary, lower-cased. */
  names?: ReadonlySet<string>;
};

const WORD = /\p{L}[\p{L}'’-]*/gu;
/** Prefixes that make a hyphenated compound acceptable on their own. */
const PREFIXES = new Set(["post", "pred", "anti", "neo", "pro", "kontra", "ne", "polu", "socio", "geo", "eko", "makro",
  "mikro", "inter", "multi", "kvazi", "pseudo", "sub", "super", "trans"]);
const OPENERS = /[\s„"«»(\[￼]+$/u;

export const lower = (word: string): string => word.toLocaleLowerCase("hr");

/** Where `word` is checked after the surrounding punctuation is cut off. */
export function checkedWord(raw: string): string {
  return raw.replace(/['’-]+$/, "");
}

export function scanBlock(text: string, skips: readonly Skip[], ctx: ScanContext): Hit[] {
  const hits: Hit[] = [];
  const ok = (w: string) => ctx.speller.correct(w);
  WORD.lastIndex = 0;
  for (let m = WORD.exec(text); m; m = WORD.exec(text)) {
    const word = checkedWord(m[0]);
    const at = m.index;
    if (word.length < 2) continue;
    if (word.length <= 6 && word === word.toUpperCase()) continue; // abbreviations
    if (/\p{Lu}/u.test(word.slice(1))) continue; // inner capitals: names, codes
    if (ctx.known.has(lower(word))) continue;
    if (skips.some(([a, b]) => at >= a && at < b)) continue;
    if (ok(word)) continue;
    if (/^\p{Lu}/u.test(word)) {
      // A capital in mid-sentence is a name; at a sentence start the lower form decides.
      const before = text.slice(0, at).replace(OPENERS, "");
      const sentenceStart = before === "" || /[.!?:]$/.test(before);
      if (!sentenceStart || ok(lower(word))) continue;
    }
    if (word.includes("-") && word.split("-").every((p) => p.length < 2 || PREFIXES.has(lower(p)) || ok(p) || ok(lower(p)))) continue;
    if (ctx.names?.has(lower(word))) continue;
    hits.push({ from: at, to: at + word.length, word });
  }
  return hits;
}
