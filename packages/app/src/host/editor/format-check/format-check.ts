// WEB-V17-FORMAT-CHECK: the pure form check. `checkFormat(doc, rules)` compares the text the server holds with
// the assignment's format rules and names every deviation per item. It never blocks: the caller shows it.
import type { TextNode } from "../../student/submission/work-read";

export type FormatRules = {
  readonly wordMin: number | null;
  readonly wordMax: number | null;
  readonly minSources: number;
  readonly requiredSections: readonly string[];
  readonly citationStyle: "fpzg";
  readonly font: string | null;
  readonly size: number | null;
  readonly spacing: number | null;
};

export type ItemId = "words" | "sources" | "sections" | "citations" | "font" | "size" | "spacing";
/** `none`: the rule is not set; `rule`: a rule only the export can apply; `unavailable`: the rule has not arrived. */
export type ItemStatus = "ok" | "deviation" | "none" | "rule" | "unavailable";
export type FormatItem = { readonly id: ItemId; readonly status: ItemStatus; readonly values: Readonly<Record<string, string | number>> };
export type FormatResult = { readonly items: readonly FormatItem[]; readonly deviations: number };

/** The heading that starts the list of sources; the words and the sections check leave it out of the body. */
const LITERATURE = /^(?:\d+(?:\.\d+)*\.?\s*)?(?:literatura|popis literature|bibliografija|izvori|popis izvora|reference)\s*$/iu;
const textOf = (node: TextNode) => node.children.map((child) => child.text).join("");
const normal = (title: string) => title.trim().replace(/^\d+(?:\.\d+)*\.?\s*/u, "").replace(/\s+/gu, " ").toLocaleLowerCase("hr-HR");
export const wordsOf = (text: string) => text.split(/\s+/u).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;

/** FPZG in-text citation, as src/domain/citation writes it: `(Becker, 2007: 9)`, `(Becker i Strauss, 2007a)`. */
const FPZG_CITATION = /^\(\p{Lu}[^(),;:]*(?:, \p{Lu}[^(),;:]*)*, \d{4}[a-z]?(?:: [^()]+)?\)$/u;
/** Anything that looks like an author-year citation, whether or not it is FPZG's. */
const CITATION_LIKE = /\(\p{Lu}[^()]{0,120}?\d{4}[a-z]?[^()]{0,40}\)|\[\d+(?:[,–-]\s*\d+)*\]/gu;
const PLACE_MARK = /^\[(?:\?|izvor|provjeri|broj|stranica|citat)/iu;

export function checkFormat(nodes: readonly TextNode[], rules: FormatRules): FormatResult {
  let inLiterature = false;
  let body = 0;
  let sources = 0;
  const headings = new Set<string>();
  const badCitations: string[] = [];
  for (const node of nodes) {
    const text = textOf(node);
    if (node.type === "heading") {
      inLiterature = LITERATURE.test(text.trim());
      if (inLiterature) headings.add("literatura");
      else headings.add(normal(text));
      continue;
    }
    if (inLiterature) {
      if (text.trim() !== "") sources += 1;
      continue;
    }
    body += wordsOf(text);
    for (const match of text.matchAll(CITATION_LIKE)) {
      if (PLACE_MARK.test(match[0])) continue;
      if (!FPZG_CITATION.test(match[0])) badCitations.push(match[0]);
    }
  }

  const items: FormatItem[] = [];
  const { wordMin, wordMax } = rules;
  items.push(wordMin === null && wordMax === null ? { id: "words", status: "none", values: { n: body } }
    : wordMin !== null && body < wordMin ? { id: "words", status: "deviation", values: { n: body, min: wordMin } }
    : wordMax !== null && body > wordMax ? { id: "words", status: "deviation", values: { n: body, max: wordMax } }
    : { id: "words", status: "ok", values: { n: body } });
  items.push(rules.minSources === 0 ? { id: "sources", status: "none", values: { n: sources } }
    : sources < rules.minSources ? { id: "sources", status: "deviation", values: { n: sources, min: rules.minSources } }
    : { id: "sources", status: "ok", values: { n: sources } });
  const missing = rules.requiredSections.filter((title) => !headings.has(LITERATURE.test(title.trim()) ? "literatura" : normal(title)));
  items.push(rules.requiredSections.length === 0 ? { id: "sections", status: "none", values: {} }
    : missing.length > 0 ? { id: "sections", status: "deviation", values: { names: missing.join(", ") } }
    : { id: "sections", status: "ok", values: {} });
  items.push(badCitations.length > 0
    ? { id: "citations", status: "deviation", values: { n: badCitations.length, example: badCitations[0] as string } }
    : { id: "citations", status: "ok", values: {} });
  // The text carries no font, size or spacing: these come from Lekta and are applied at export, so the check
  // only names the rule, or says it has not arrived.
  const lekta = (id: ItemId, value: string | number | null, unit = ""): FormatItem =>
    value === null ? { id, status: "unavailable", values: {} } : { id, status: "rule", values: { value: `${value}${unit}` } };
  items.push(lekta("font", rules.font), lekta("size", rules.size, " pt"), lekta("spacing", rules.spacing));
  return { items, deviations: items.filter((item) => item.status === "deviation").length };
}
