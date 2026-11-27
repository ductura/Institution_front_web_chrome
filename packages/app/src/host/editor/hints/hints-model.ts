// ED-82: the writing hints of the prototype (features.js "Analiza teksta", app.js CLAIM and long
// sentences), as a pure model: the places in the text a hint underlines and what its popover says.
// Nothing here changes the document; the host draws decorations and applies a chosen replacement.
import type { Node as PmNode } from "@tiptap/pm/model";

export type HintKind = "claim" | "long" | "abbr" | "term" | "colloq" | "absolute" | "first" | "passive" | "trans" | "short";
export const HINT_KINDS: readonly HintKind[] = ["claim", "long", "abbr", "term", "colloq", "absolute", "first", "passive", "trans", "short"];

export type Hint =
  | { readonly kind: "colloq" | "absolute" | "first"; readonly from: number; readonly to: number; readonly word: string; readonly alts: readonly string[] }
  | { readonly kind: "claim" | "long"; readonly from: number; readonly to: number }
  | { readonly kind: "passive"; readonly from: number; readonly to: number; readonly n: number }
  | { readonly kind: "short"; readonly from: number; readonly to: number; readonly first: string; readonly joined: string }
  | { readonly kind: "abbr"; readonly from: number; readonly to: number; readonly ab: string; readonly full: string }
  | { readonly kind: "term"; readonly from: number; readonly to: number; readonly sub: "early" | "nodef"; readonly term: string; readonly def: string }
  | { readonly kind: "trans"; readonly from: number; readonly to: number; readonly prev: string; readonly key: string };

export type GlossaryTerm = { readonly term: string; readonly definition: string };

/** What a citation or another inline atom stands for in the text of a block (one position wide). */
const ATOM = "￼";
const WORD = /[\p{L}\d]+(?:[-'][\p{L}\d]+)*/gu;
export const wordCount = (text: string): number => (text.match(WORD) ?? []).length;

const w = (word: string) => new RegExp(`(?<!\\p{L})${word}(?!\\p{L})`, "giu");
/** Prototype REG: the word, and what an academic text says instead. */
const REG: Record<"colloq" | "absolute" | "first", readonly (readonly [RegExp, readonly string[]])[]> = {
  colloq: [[w("jako"), ["vrlo", "izrazito"]], [w("puno"), ["mnogo", "znatno"]], [w("stvarno"), ["doista"]], [w("u biti"), ["u osnovi"]], [w("dosta"), ["prilično"]], [w("super"), ["vrlo dobro"]]],
  absolute: [[w("dokazuje"), ["upućuje na", "pokazuje"]], [w("dokazuju"), ["upućuju na"]], [w("uvijek"), ["često", "u pravilu"]], [w("nikada?"), ["rijetko"]], [w("svi"), ["većina"]], [w("sigurno"), ["vjerojatno"]], [w("nedvojbeno"), ["čini se da"]], [w("očito"), ["može se reći"]]],
  first: [[w("mislim"), ["može se pretpostaviti"]], [w("smatram"), ["čini se da"]], [w("analizirat ću"), ["analizira se"]], [w("istražit ću"), ["istražuje se"]], [w("pokušat ću"), ["nastoji se"]]],
};
const PASS = /(?<!\p{L})(?:je|su|bio|bila|bilo|bili)\s+\p{L}{3,}(?:en|na|no|ni|ne)(?!\p{L})|(?<!\p{L})\p{L}{3,}(?:en|na|no|ni|ne)\s+(?:je|su)(?!\p{L})/iu;
const CLAIM = /(brojn\p{L}* (istraživanj|autor|studij)|istraživanja (su )?pokaz|pokazalo se|u literaturi se|smatra se da|poznato je da|dokazano je|uvriježen|općenito se|više autora tvrdi|često se (navodi|ističe))/iu;
/** A citation typed as text, as the marks read it: "(Autor, 2020)". */
const PLAIN_CITE = /\(\p{Lu}[^()\d￼]{1,40},\s*\d{4}[a-z]?(?::\s*[\d–-]+)?\)/u;
const CONN = /^(međutim|stoga|osim toga|nadalje|s druge strane|zato|također|primjerice|na primjer|ipak|dakle|iz toga|unatoč|usto|nasuprot|slično|za razliku|kao što|prema tome|zbog toga|time|nakon|u tom|u tome|takv|ta |taj |to |tu |ovaj|ova |ovo |ove |ovi |ovim|ovih|ti |te |tom |tim |njeg|njih|on |ona |oni |iako|no |ali |a |zaključno|pritom)/i;
const DEF = /(shvaća|definira|označava|podrazumijeva|odnosi se na|naziva se)/i;
const ABBR = /(?<!\p{L})[A-ZČĆŠŽĐ]{2,6}(?!\p{L})/gu;
const FULL = /^(.*?)\s*\(([A-ZČĆŠŽĐ]{2,})\)$/u;
const SENT = /[^.!?…]+(?:[.!?…]+[”"»)]*|$)/g;

type Sentence = { a: number; e: number; s: string };
export function sentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  for (const m of text.matchAll(SENT)) {
    const raw = m[0];
    if (!raw.trim()) continue;
    const a = m.index + (raw.length - raw.trimStart().length);
    const e = m.index + raw.trimEnd().length;
    out.push({ a, e, s: text.slice(a, e) });
  }
  return out;
}

const stems = (x: string) => new Set((x.toLowerCase().match(/\p{L}{5,}/gu) ?? []).map((word) => word.slice(0, 5)));
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A glossary term in any case ending: each word without its last two letters (when longer than five). */
const stemRe = (term: string) => new RegExp(`(?<!\\p{L})${term.trim().split(/\s+/).map((x) => `${escape(x.length > 5 ? x.slice(0, x.length - 2) : x)}\\p{L}*`).join("\\s+")}`, "giu");

type Block = { text: string; base: number; ss: Sentence[]; isP: boolean; sec: number };

function blocksOf(doc: PmNode): Block[] {
  const out: Block[] = [];
  let sec = -1;
  doc.descendants((node, pos, parent) => {
    if (!node.isTextblock) return true;
    if (node.type.name === "heading") sec += 1;
    const text = node.textBetween(0, node.content.size, "", ATOM);
    out.push({ text, base: pos + 1, ss: sentences(text), isP: parent === doc && node.type.name === "paragraph", sec });
    return false;
  });
  return out;
}

export type HintInput = {
  readonly enabled: ReadonlySet<HintKind>;
  readonly glossary?: readonly GlossaryTerm[];
  /** Keys of transitions the student accepted with "U redu je". */
  readonly transOk?: ReadonlySet<string>;
};

/** Every hint of the enabled kinds, in the order of the text. */
export function findHints(doc: PmNode, { enabled, glossary = [], transOk = new Set() }: HintInput): Hint[] {
  const out: Hint[] = [];
  const on = (kind: HintKind) => enabled.has(kind);
  const blocks = blocksOf(doc);

  blocks.forEach(({ text, base, ss }) => {
    for (const kind of ["colloq", "absolute", "first"] as const) {
      if (!on(kind)) continue;
      for (const [re, alts] of REG[kind]) {
        for (const m of text.matchAll(re)) out.push({ kind, from: base + m.index, to: base + m.index + m[0].length, word: m[0], alts });
      }
    }
    if (on("passive")) {
      let run: Sentence[] = [];
      const flush = () => {
        if (run.length >= 3) for (const r of run) out.push({ kind: "passive", from: base + r.a, to: base + r.e, n: run.length });
        run = [];
      };
      for (const x of ss) { if (PASS.test(x.s)) run.push(x); else flush(); }
      flush();
    }
    if (on("short")) {
      for (let i = 0; i + 1 < ss.length; i++) {
        const A = ss[i]!, B = ss[i + 1]!;
        const fa = A.s.match(/^\p{L}+/u)?.[0] ?? "", fb = B.s.match(/^\p{L}+/u)?.[0] ?? "";
        if (fa && fa.toLowerCase() === fb.toLowerCase() && wordCount(A.s) <= 7 && wordCount(B.s) <= 7 && !(A.s + B.s).includes(ATOM)) {
          const rest = B.s.slice(fb.length).trim();
          out.push({ kind: "short", from: base + A.a, to: base + B.e, first: fa, joined: `${A.s.replace(/[.!?…]+$/u, "")} i ${rest}` });
          i++;
        }
      }
    }
    for (const x of ss) {
      const cited = x.s.includes(ATOM) || PLAIN_CITE.test(x.s);
      if (on("claim") && !cited && CLAIM.test(x.s)) out.push({ kind: "claim", from: base + x.a, to: base + x.e });
      if (on("long") && wordCount(x.s) > 40) out.push({ kind: "long", from: base + x.a, to: base + x.e });
    }
  });

  if (on("term")) {
    for (const g of glossary) {
      const re = stemRe(g.term);
      const defIdx = blocks.findIndex((b) => { re.lastIndex = 0; return re.test(b.text) && DEF.test(b.text); });
      let flagged = false;
      blocks.forEach((b, bi) => {
        re.lastIndex = 0; // matchAll starts where the last test left the expression
        for (const m of b.text.matchAll(re)) {
          const at = { from: b.base + m.index, to: b.base + m.index + m[0].length, term: g.term, def: g.definition };
          if (defIdx >= 0 && bi < defIdx) out.push({ kind: "term", sub: "early", ...at });
          else if (defIdx < 0 && !flagged) { flagged = true; out.push({ kind: "term", sub: "nodef", ...at }); }
        }
      });
    }
  }

  if (on("abbr")) {
    const full: Record<string, string> = {};
    for (const g of glossary) {
      const m = g.term.match(FULL) ?? g.definition.match(FULL);
      if (m) full[m[2]!] = m[1]!;
    }
    const seen = new Set<string>();
    for (const b of blocks) {
      for (const m of b.text.matchAll(ABBR)) {
        const ab = m[0];
        if (seen.has(ab) || /^[IVXLC]+$/u.test(ab)) continue;
        seen.add(ab);
        if (b.text[m.index - 1] !== "(") out.push({ kind: "abbr", from: b.base + m.index, to: b.base + m.index + ab.length, ab, full: full[ab] ?? "" });
      }
    }
  }

  if (on("trans")) {
    for (let i = 1; i < blocks.length; i++) {
      const b = blocks[i]!, p = blocks[i - 1]!;
      if (!b.isP || !b.ss.length || !p.isP || !p.ss.length || p.sec !== b.sec) continue;
      const la = p.ss[p.ss.length - 1]!.s, fb = b.ss[0]!, key = fb.s.slice(0, 40);
      const A = stems(la);
      const shared = [...stems(fb.s)].some((x) => A.has(x));
      if (!shared && !CONN.test(fb.s) && !transOk.has(key) && wordCount(fb.s) > 4) out.push({ kind: "trans", from: b.base + fb.a, to: b.base + fb.e, prev: la, key });
    }
  }

  return out.sort((a, b) => a.from - b.from || a.to - b.to);
}

/** The hints whose range holds `pos`, the shortest first (a word inside an underlined sentence wins). */
export function hintsAt(hints: readonly Hint[], pos: number): Hint[] {
  return hints.filter((h) => pos >= h.from && pos <= h.to).sort((a, b) => (a.to - a.from) - (b.to - b.from));
}

/** Prototype hintRep: a replacement keeps the capital of the word it replaces; "Spoji" is taken as written. */
export function replacementFor(hint: Hint, original: string, alt: string): string {
  if (hint.kind === "short" || !alt) return alt;
  const first = original.charAt(0);
  return first && first === first.toLocaleUpperCase("hr") && first !== first.toLocaleLowerCase("hr")
    ? alt.charAt(0).toLocaleUpperCase("hr") + alt.slice(1) : alt;
}
