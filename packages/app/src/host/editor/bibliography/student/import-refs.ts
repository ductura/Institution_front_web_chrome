/**
 * "Uvoz literature" (INVENTAR-editor §2.2 app.js): BibTeX and RIS text become
 * document sources. A record that cannot satisfy the document schema for its
 * type is not imported (counted apart); a double (same year and first 30
 * characters of the title) is skipped, as in the prototype.
 */
import { validateSources } from "@/domain/document/validate-sources";
import type { ValidationError } from "@/domain/document/validate";

export type Author = { kind: "person"; family: string; given: string } | { kind: "organization"; name: string };
export type RefRecord = Record<string, unknown> & { type: string; authors: Author[]; year?: number; title?: string };

const clean = (v: string) => v.replace(/[{}]/g, "").replace(/\s+/g, " ").trim();

function person(text: string): Author | null {
  const t = clean(text);
  if (!t) return null;
  if (t.includes(",")) {
    const [family = "", given = ""] = t.split(",", 2).map((x) => x.trim());
    return family ? { kind: "person", family, given } : null;
  }
  const words = t.split(" ");
  return words.length === 1 ? { kind: "organization", name: t }
    : { kind: "person", family: words[words.length - 1]!, given: words.slice(0, -1).join(" ") };
}

function year(text: string | undefined): number | undefined {
  const m = /\b(1\d{3}|20\d{2})\b/.exec(text ?? "");
  return m ? Number(m[1]) : undefined;
}

export function parseBibtex(text: string): RefRecord[] {
  const out: RefRecord[] = [];
  const entry = /@(\w+)\s*\{\s*[^,{}]*,([\s\S]*?)\n\s*\}/g;
  for (const [, kind = "", body = ""] of text.matchAll(entry)) {
    if (/^(comment|string|preamble)$/i.test(kind)) continue;
    const f: Record<string, string> = {};
    for (const m of body.matchAll(/(\w+)\s*=\s*(?:\{((?:[^{}]|\{[^{}]*\})*)\}|"([^"]*)"|([\w.-]+))/g)) {
      f[m[1]!.toLowerCase()] = clean(m[2] ?? m[3] ?? m[4] ?? "");
    }
    const k = kind.toLowerCase();
    const type = k === "article" ? "article" : k === "inbook" || k === "incollection" ? "chapter"
      : f.url && !f.publisher && !f.journal ? "web" : "book";
    const authors = (f.author ?? "").split(/\s+and\s+/i).map(person).filter((a): a is Author => a !== null);
    out.push({
      type, authors, year: year(f.year ?? f.date), title: f.title,
      journal: f.journal, volume: f.volume, issue: f.number, pages: f.pages?.replace(/--/g, "–"),
      publisher: f.publisher, place: f.address, url: f.url, bookTitle: f.booktitle,
      editors: (f.editor ?? "").split(/\s+and\s+/i).map(person).filter((a): a is Author => a !== null),
    });
  }
  return out;
}

export function parseRis(text: string): RefRecord[] {
  const out: RefRecord[] = [];
  let f: Record<string, string[]> | null = null;
  const close = () => {
    if (!f) return;
    const first = (k: string) => f![k]?.[0];
    const ty = first("TY") ?? "";
    const type = ty === "JOUR" ? "article" : ty === "CHAP" ? "chapter" : ty === "ELEC" || ty === "WEB" ? "web" : "book";
    out.push({
      type, authors: [...(f.AU ?? []), ...(f.A1 ?? [])].map(person).filter((a): a is Author => a !== null),
      year: year(first("PY") ?? first("Y1") ?? first("DA")), title: first("TI") ?? first("T1"),
      journal: first("JO") ?? first("JF") ?? first("T2"), volume: first("VL"), issue: first("IS"),
      pages: first("SP") ? `${first("SP")}${first("EP") ? `–${first("EP")}` : ""}` : undefined,
      publisher: first("PB"), place: first("CY"), url: first("UR"), bookTitle: first("T2"),
      editors: (f.A2 ?? f.ED ?? []).map(person).filter((a): a is Author => a !== null),
    });
    f = null;
  };
  for (const line of text.split(/\r?\n/)) {
    const m = /^([A-Z][A-Z0-9])\s{1,2}-\s?(.*)$/.exec(line);
    if (!m) continue;
    if (m[1] === "TY") { close(); f = {}; }
    if (m[1] === "ER") { close(); continue; }
    if (f) (f[m[1]!] ??= []).push(clean(m[2] ?? ""));
  }
  close();
  return out;
}

export function parseReferences(text: string): RefRecord[] {
  return /^\s*TY\s{1,2}-/m.test(text) ? parseRis(text) : parseBibtex(text);
}

const dedupKey = (title: string, y: unknown) => `${y}|${title.normalize("NFC").toLocaleLowerCase("hr").replace(/\s+/g, " ").trim().slice(0, 30)}`;

/** Document source ready for `docAttr sources`, or null when the schema would refuse it. */
export function toDocumentSource(rec: RefRecord, id: string, accessed: string): Record<string, unknown> | null {
  if (!rec.title || rec.year === undefined || rec.authors.length === 0) return null;
  const base = { id, type: rec.type, authors: rec.authors, year: rec.year, title: rec.title };
  const pick = (keys: string[]) => Object.fromEntries(keys.filter((k) => rec[k]).map((k) => [k, rec[k]]));
  const extra = rec.type === "book" ? pick(["place", "publisher"])
    : rec.type === "article" ? pick(["journal", "volume", "issue", "pages"])
    : rec.type === "chapter" ? { editors: rec.editors ?? [], ...pick(["bookTitle", "place", "publisher", "pages"]) }
    : { ...pick(["url"]), accessed };
  const source = { ...base, ...extra };
  const errors: ValidationError[] = [];
  validateSources([source], errors);
  return errors.length === 0 ? source : null;
}

export type ImportResult = {
  kind: "none" | "done";
  added: Record<string, unknown>[];
  skippedDuplicates: number;
  incomplete: number;
};

/** What the import adds to `existing` sources; nothing is written here. */
export function planImport(text: string, existing: readonly Record<string, unknown>[], newId: () => string, accessed: string): ImportResult {
  const records = parseReferences(text);
  if (records.length === 0) return { kind: "none", added: [], skippedDuplicates: 0, incomplete: 0 };
  const seen = new Set(existing.map((s) => dedupKey(String(s.title ?? ""), s.year)));
  const added: Record<string, unknown>[] = [];
  let skippedDuplicates = 0;
  let incomplete = 0;
  for (const rec of records) {
    const key = dedupKey(rec.title ?? "", rec.year);
    if (rec.title && seen.has(key)) { skippedDuplicates += 1; continue; }
    const source = toDocumentSource(rec, newId(), accessed);
    if (!source) { incomplete += 1; continue; }
    seen.add(key);
    added.push(source);
  }
  return { kind: "done", added, skippedDuplicates, incomplete };
}
