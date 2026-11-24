/** Splits text into pieces for speech synthesis: by sentence, each at most MAX_CHUNK characters (browsers cut off very long utterances). */
export const MAX_CHUNK = 200;

export type Chunk = { text: string; start: number; end: number };

const SENTENCE_END = /[.!?…]+["'”»)\]]*(?=\s|$)|\n+/g;

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
  for (const match of source.matchAll(SENTENCE_END)) {
    const end = match.index + match[0].length;
    splitLong(source, from, end, limit, out);
    from = end;
  }
  splitLong(source, from, source.length, limit, out);
  return out;
}
