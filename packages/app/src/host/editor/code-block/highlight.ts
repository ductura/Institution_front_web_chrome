// WEB-V21-STEM-KOD-BLOK: bojenje koda lokalnom bibliotekom (highlight.js jezgra, 7 jezika, BSD-3), bez mreže.
// Čista funkcija: vraća raspone (od, do, razred) nad tekstom koda; tekst dokumenta se nikad ne mijenja.
// Kad biblioteka ne radi (ili jezik nije na popisu), rezultat je null i blok se prikazuje bez bojenja.
import hljs from "highlight.js/lib/core";
import c from "highlight.js/lib/languages/c";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import python from "highlight.js/lib/languages/python";
import r from "highlight.js/lib/languages/r";
import sql from "highlight.js/lib/languages/sql";
import xml from "highlight.js/lib/languages/xml";

/** Isti popis kao `CODE_LANGUAGES` u shemi v4 (editor-core); zasebna kopija da paket ne ovisi o internoj datoteci. */
export const CODE_LANGUAGES = ["c", "html", "java", "javascript", "python", "r", "sql"] as const;
export type CodeLanguage = (typeof CODE_LANGUAGES)[number];

export const isCodeLanguage = (value: unknown): value is CodeLanguage =>
  typeof value === "string" && (CODE_LANGUAGES as readonly string[]).includes(value);

/** Naslov ispisa: najviše 300 točaka koda (`MAX_CODE_CAPTION_CODE_POINTS`). */
export const MAX_CODE_CAPTION_CODE_POINTS = 300;

export type HighlightRange = { readonly from: number; readonly to: number; readonly className: string };

/** Ulaz iznad ovoga se ne boji (veliki ispis ne smije usporiti uređivanje). */
export const MAX_HIGHLIGHT_CODE_UNITS = 20000;

const HLJS_NAME: Record<CodeLanguage, string> = {
  c: "c", html: "xml", java: "java", javascript: "javascript", python: "python", r: "r", sql: "sql",
};
let registered = false;
function register(): void {
  if (registered) return;
  hljs.registerLanguage("c", c);
  hljs.registerLanguage("java", java);
  hljs.registerLanguage("javascript", javascript);
  hljs.registerLanguage("python", python);
  hljs.registerLanguage("r", r);
  hljs.registerLanguage("sql", sql);
  hljs.registerLanguage("xml", xml);
  registered = true;
}

type Engine = (code: string, language: CodeLanguage) => string;
const defaultEngine: Engine = (code, language) => {
  register();
  return hljs.highlight(code, { language: HLJS_NAME[language], ignoreIllegals: true }).value;
};
let engine: Engine = defaultEngine;
/** Samo za testove: zamjena biblioteke (npr. onom koja baca); `null` vraća pravu. */
export function setHighlightEngine(next: Engine | null): void { engine = next ?? defaultEngine; }

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#x27;": "'", "&#39;": "'" };
const decode = (text: string) => text.replace(/&(?:amp|lt|gt|quot|#x27|#39);/g, (m) => ENTITIES[m] ?? m);

/**
 * Pretvara HTML koji biblioteka vraća u raspone nad izvornim tekstom. Vraća null ako se dekodirani tekst
 * ne poklapa s ulazom (tada se ne boji ništa, da raspon nikad ne pogodi krivo mjesto).
 */
export function rangesFromHtml(html: string, code: string): HighlightRange[] | null {
  const ranges: HighlightRange[] = [];
  const open: { from: number; className: string }[] = [];
  let at = 0;
  let text = "";
  for (const part of html.split(/(<span class="[^"]*">|<\/span>)/)) {
    const start = /^<span class="([^"]*)">$/.exec(part);
    if (start) { open.push({ from: at, className: start[1]! }); continue; }
    if (part === "</span>") {
      const top = open.pop();
      if (!top) return null;
      if (at > top.from) ranges.push({ from: top.from, to: at, className: top.className });
      continue;
    }
    const plain = decode(part);
    text += plain;
    at += plain.length;
  }
  if (open.length > 0 || text !== code) return null;
  return ranges;
}

/** Raspon bojenja za kod; null kad jezika nema, kod je predug ili biblioteka nije dostupna. */
export function highlightRanges(code: string, language: string | null | undefined): HighlightRange[] | null {
  if (!isCodeLanguage(language) || code === "" || code.length > MAX_HIGHLIGHT_CODE_UNITS) return null;
  try {
    return rangesFromHtml(engine(code, language), code);
  } catch {
    return null;
  }
}

/** Broj redaka koda za stupac brojeva (prazan kod ima jedan redak). */
export function lineCount(code: string): number {
  return code.split("\n").length;
}
