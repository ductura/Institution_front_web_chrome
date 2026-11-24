/** Splits text into pieces for speech synthesis: by sentence, each at most MAX_CHUNK characters (browsers cut off very long utterances). */
export const MAX_CHUNK = 200;

export type Chunk = { text: string; start: number; end: number };

const TERMINATORS = ".!?…";
const CLOSERS = "\"'”»)]";
const isSpace = (ch: string | undefined) => ch === undefined || /\s/.test(ch);

/** End offsets of sentences. One linear pass (a regex retried every suffix of a long punctuation run: quadratic). */
function sentenceEnds(source: string): number[] {
  const ends: number[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i] as string;
    if (ch === "\n") {
      while (source[i] === "\n") i += 1;
      ends.push(i);
    } else if (TERMINATORS.includes(ch)) {
      let j = i;
      while (j < source.length && TERMINATORS.includes(source[j] as string)) j += 1;
      while (j < source.length && CLOSERS.includes(source[j] as string)) j += 1;
      if (isSpace(source[j])) ends.push(j);
      i = j;
    } else i += 1;
  }
  return ends;
}

/** Splits [start,end) of `source` at the last separator before the limit; falls back to a hard cut. */
function splitLong(source: string, start: number, end: number, max: number, out: Chunk[]): void {
  let from = start;
  while (end - from > max) {
    const window = source.slice(from, from + max);
    const comma = Math.max(window.lastIndexOf(", "), window.lastIndexOf("; "), window.lastIndexOf(": "));
    const space = window.lastIndexOf(" ");
    const cut = comma > 0 ? from + comma + 1 : space > 0 ? from + space : from + max;
    push(source, from, cut, out);
    from = cut;
  }
  push(source, from, end, out);
}

function push(source: string, start: number, end: number, out: Chunk[]): void {
  const raw = source.slice(start, end);
  const text = raw.trim();
  if (!text) return;
  const lead = raw.length - raw.trimStart().length;
  out.push({ text, start: start + lead, end: start + lead + text.length });
}

export function splitIntoChunks(source: string, max: number = MAX_CHUNK): Chunk[] {
  const limit = Math.max(20, Math.floor(max));
  const out: Chunk[] = [];
  if (!source.trim()) return out;
  let from = 0;
  for (const end of sentenceEnds(source)) {
    splitLong(source, from, end, limit, out);
    from = end;
  }
  splitLong(source, from, source.length, limit, out);
  return out;
}
