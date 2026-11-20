/**
 * The quote and the attached page (E§3.4 proofs, stem.js `judge`, B-8). The
 * comparison is letter by letter on a normalised text and does not read
 * meaning. A near miss says "tekst navoda razlikuje se od priložene stranice"
 * (B-8, owner 19. 11.), never that the quote "does not agree with the source".
 * It runs only in the browser, on the text layer of the PDF page that never
 * leaves the device.
 */

import type { Rect } from "./crop";

/** Fewer letters than this is not a quote to look for (prototype `nrm(q).length < 8`). */
export const QUOTE_MIN = 8;
/** A page with less text than this is a scan (prototype `< 20`). */
export const SCAN_TEXT_MIN = 20;
/** Share of the quote's words that must be on the page, and in one window, for a near miss. */
export const COVER_MIN = 0.6;
export const WINDOW_MIN = 0.7;

/** Croatian lower case, without quotation marks, punctuation and words split at a line end. */
export function normalizeQuote(text: string): string {
  return text
    .toLocaleLowerCase("hr")
    .replace(/[„“”"'’‚«»]/g, "")
    .replace(/(\p{L})[-­]\s+(\p{L})/gu, "$1$2")
    .replace(/[.,;:!?()[\]…–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type QuoteJudgement =
  | { readonly kind: "short" }
  | { readonly kind: "scan" }
  | { readonly kind: "found" }
  /** Most words are there, in other wording: `missing` lists the quote's words not in the nearest window. */
  | { readonly kind: "differs"; readonly near: string; readonly missing: readonly string[] }
  | { readonly kind: "missing" };

/** The quote against the text of one page. */
export function judgeQuote(quote: string, pageText: string): QuoteJudgement {
  const q = normalizeQuote(quote);
  if (q.length < QUOTE_MIN) return { kind: "short" };
  const page = normalizeQuote(pageText);
  if (page.length < SCAN_TEXT_MIN) return { kind: "scan" };
  if (page.includes(q)) return { kind: "found" };
  const qw = q.split(" ");
  const pw = page.split(" ");
  const onPage = new Set(pw);
  if (qw.filter((w) => onPage.has(w)).length / qw.length < COVER_MIN) return { kind: "missing" };
  let best = 0;
  let at = 0;
  for (let i = 0; i < pw.length; i++) {
    const window = new Set(pw.slice(i, i + qw.length));
    const hits = qw.filter((w) => window.has(w)).length;
    if (hits > best) { best = hits; at = i; }
  }
  if (best / qw.length < WINDOW_MIN) return { kind: "missing" };
  const nearWords = pw.slice(at, at + qw.length);
  const nearSet = new Set(nearWords);
  return { kind: "differs", near: nearWords.join(" "), missing: qw.filter((w) => !nearSet.has(w)) };
}

/** One run of text of a PDF page, in the pixels of the rendered page. */
export type TextRun = { readonly str: string } & Rect;

/** The text of a page from its runs, one space between runs. */
export function pageText(runs: readonly TextRun[]): string {
  return runs.map((r) => r.str).join(" ");
}

/**
 * The rectangle around the runs that hold the quote on this page, padded by
 * 16 px within `bounds` (prototype `autoRect`); null when the quote is not
 * there word for word.
 */
export function quoteRect(runs: readonly TextRun[], quote: string, bounds: { width: number; height: number }, pad = 16): Rect | null {
  const q = normalizeQuote(quote);
  if (q.length < QUOTE_MIN) return null;
  // The normalised text with, for each of its characters, the run it came from.
  let text = "";
  const owner: number[] = [];
  runs.forEach((run, index) => {
    const part = normalizeQuote(run.str);
    if (part === "") return;
    if (text !== "") { text += " "; owner.push(index); }
    text += part;
    for (let i = 0; i < part.length; i++) owner.push(index);
  });
  // A quote over a word split at the line end is judged by judgeQuote, but gets no frame here.
  const start = text.indexOf(q);
  if (start < 0) return null;
  const used = new Set(owner.slice(start, start + q.length));
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const i of used) {
    const r = runs[i];
    if (r === undefined) continue;
    x1 = Math.min(x1, r.x); y1 = Math.min(y1, r.y);
    x2 = Math.max(x2, r.x + r.width); y2 = Math.max(y2, r.y + r.height);
  }
  if (!Number.isFinite(x1)) return null;
  const x = Math.max(0, x1 - pad);
  const y = Math.max(0, y1 - pad);
  return { x, y, width: Math.min(bounds.width, x2 + pad) - x, height: Math.min(bounds.height, y2 + pad) - y };
}

export type QuoteSearch =
  | { readonly kind: "short" }
  | { readonly kind: "found"; readonly page: number }
  /** No page holds it word for word; this page holds it in other wording (B-8). */
  | { readonly kind: "differs"; readonly page: number }
  | { readonly kind: "missing" };

/**
 * Looks for the quote through the pages (prototype `searchAll`, at most
 * `max` pages): the first page that holds it word for word, else the first
 * that holds it in other wording. Only the text layer is read.
 */
export async function searchQuote(
  pdf: { readonly count: number; readonly text: (n: number) => Promise<readonly TextRun[]> }, quote: string, max = 600,
  stillWanted: () => boolean = () => true,
): Promise<QuoteSearch> {
  if (normalizeQuote(quote).length < QUOTE_MIN) return { kind: "short" };
  let near: number | null = null;
  for (let n = 1; n <= Math.min(pdf.count, max); n++) {
    if (!stillWanted()) return { kind: "missing" };
    const judged = judgeQuote(quote, pageText(await pdf.text(n)));
    if (judged.kind === "found") return { kind: "found", page: n };
    if (judged.kind === "differs" && near === null) near = n;
  }
  return near === null ? { kind: "missing" } : { kind: "differs", page: near };
}
