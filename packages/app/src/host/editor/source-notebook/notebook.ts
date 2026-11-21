import { isAllowedText } from "@/domain/document/forbidden";
import { citationRange, insertCitation, validCitationPage } from "@/components/editor/citations/citation-document";
import type { ProofSource } from "@/components/editor/sources/proofs/proof-sources";
import { readSourceNotes, type SourceNote } from "@/client/source-notebook";

export type NotebookEntry = SourceNote & { source: ProofSource };

export async function loadNotebook(
  documentId: string, sources: readonly ProofSource[], signal: AbortSignal, read = readSourceNotes,
) {
  const entries: NotebookEntry[] = [];
  let incomplete = false;
  // The contract is per source. A large bibliography must not start hundreds of requests at once.
  for (let offset = 0; offset < sources.length && !signal.aborted; offset += 4) {
    const batch = sources.slice(offset, offset + 4);
    const reads = await Promise.all(batch.map(async (source) => ({
      source, result: await read(documentId, source.id, signal),
    })));
    for (const { source, result } of reads) {
      if (result.kind === "signedOut") return { kind: "signedOut" } as const;
      if (result.kind === "unavailable") incomplete = true;
      else entries.push(...result.notes.map((note) => ({ ...note, source })));
    }
  }
  return { kind: "ready", entries, incomplete } as const;
}

function fold(value: string) {
  return value.toLocaleLowerCase("hr").normalize("NFD").replace(/\p{M}/gu, "").replaceAll("đ", "d");
}

export function findNotes(entries: readonly NotebookEntry[], query: string) {
  const terms = fold(query.trim()).split(/\s+/u).filter(Boolean);
  return entries.filter(({ quote, note, page, source }) => {
    const text = fold([quote, note, page, source.label].join(" "));
    return terms.every((term) => text.includes(term));
  });
}

export function citationFromNote({ page, quote }: SourceNote) {
  const locator = page?.trim();
  if (!locator) return { kind: "missingPage" } as const;
  if (!validCitationPage(locator)) return { kind: "invalidPage" } as const;
  const text = quote?.trim().replace(/[\t\r\n]+/gu, " ");
  if (text && !isAllowedText(text, 4000)) return { kind: "invalidQuote" } as const;
  return { kind: "ready", locator, text } as const;
}

export function insertNotebookCitation(state: Parameters<typeof citationRange>[0], entry: NotebookEntry) {
  const range = citationRange(state);
  const citation = citationFromNote(entry);
  if (!range || citation.kind !== "ready") return null;
  const tr = insertCitation(state, range, entry.source.id, citation.locator);
  if (!tr) return null;
  // Keep the quote and the existing citation atom in the same transaction and undo step.
  return citation.text ? tr.insertText(`„${citation.text}” `, range.from) : tr;
}
