/**
 * What the proofs panel reads from the open document (E§3.4 proofs): the
 * sources of the work (`doc.attrs.sources`, V2 and later) and the citations
 * that point at them with their page (`locator`). The document is read, never
 * written: a proof lives on the server beside the source, not in the text.
 */

import { normalPage, type SourceProof } from "../../../../client/source-proofs";

export type ProofSource = { readonly id: string; readonly label: string };
export type CitationPlace = { readonly sourceId: string; readonly page: string | null };

type Json = { readonly type?: unknown; readonly attrs?: Record<string, unknown>; readonly content?: readonly Json[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function authorName(author: unknown): string | null {
  if (typeof author !== "object" || author === null) return null;
  const a = author as Record<string, unknown>;
  if (a.kind === "person" && typeof a.family === "string") return a.family;
  if (a.kind === "organization" && typeof a.name === "string") return typeof a.acronym === "string" && a.acronym !== "" ? a.acronym : a.name;
  return null;
}

/** "Autor (godina)", or "Autor i Autor (godina)", or "Autor i sur. (godina)"; the title without authors. */
export function sourceLabel(source: Record<string, unknown>): string {
  const names = (Array.isArray(source.authors) ? source.authors : []).map(authorName).filter((n): n is string => n !== null && n !== "");
  const year = typeof source.year === "number" ? String(source.year) : "";
  const [first = "", second = ""] = names;
  const who = names.length === 0 ? (typeof source.title === "string" ? source.title : "")
    : names.length === 1 ? first : names.length === 2 ? `${first} i ${second}` : `${first} i sur.`;
  return year === "" ? who : `${who} (${year})`;
}

/** The sources of the document with a UUID id, in their order, each once. */
export function documentSources(doc: Json | null | undefined): ProofSource[] {
  const list = doc?.attrs?.sources;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: ProofSource[] = [];
  for (const item of list) {
    if (typeof item !== "object" || item === null) continue;
    const source = item as Record<string, unknown>;
    if (typeof source.id !== "string" || !UUID.test(source.id) || seen.has(source.id)) continue;
    seen.add(source.id);
    out.push({ id: source.id, label: sourceLabel(source) });
  }
  return out;
}

/** Every citation of the document with its source and page, in text order. */
export function documentCitations(doc: Json | null | undefined): CitationPlace[] {
  const out: CitationPlace[] = [];
  const walk = (node: Json) => {
    if (node.type === "citation" && typeof node.attrs?.sourceId === "string") {
      const locator = node.attrs.locator;
      out.push({ sourceId: node.attrs.sourceId, page: typeof locator === "string" && locator.trim() !== "" ? locator : null });
    }
    node.content?.forEach(walk);
  };
  if (doc) walk(doc);
  return out;
}

/** The first page number of a locator or page ("str. 14-16" and "14" both give "14"). */
export function firstPage(page: string): string {
  const p = normalPage(page).toLocaleLowerCase("hr").replace(/^(?:str|s|p|pp)\.?\s*/, "");
  return p.split(/\s*[-–]\s*/)[0] ?? p;
}

/**
 * The proofs that stand beside a citation (prototype `forCite`): the same
 * source and the same first page; a citation without a page takes every
 * proof of its source.
 */
export function proofsForCitation(proofs: readonly SourceProof[], citation: CitationPlace): SourceProof[] {
  return proofs.filter((p) => p.sourceId === citation.sourceId
    && (citation.page === null || firstPage(p.page) === firstPage(citation.page)));
}

/** How many citations have at least one proof beside them. */
export function citedWithProof(citations: readonly CitationPlace[], proofs: readonly SourceProof[]): number {
  return citations.filter((c) => proofsForCitation(proofs, c).length > 0).length;
}
