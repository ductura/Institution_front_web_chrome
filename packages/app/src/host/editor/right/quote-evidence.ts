// ED-40 (P2-11), orchestrator's option 1: the quote check compares a literal quote with the student's own
// notes on its source, read through the existing route student.source-proofs.get (no contract change). A
// proof is an image without a text layer, so only its note is text here; `proofs` stays empty.
import type { ProofsRead } from "../../../../../../src/client/source-proofs";
import type { CanonicalDocumentV4 } from "../../../../../editor-core/src/document/document/index.ts";
import { findQuotes, type EvidenceBySource, type SourceEvidence } from "../stem/quote-check";

/** At most this many sources are read for one check, so a long work never floods the server. */
export const QUOTE_SOURCES_MAX = 40;

/** The sources the check needs: those cited after a literal quote, each once, in the order of the work. */
export function quotedSources(doc: CanonicalDocumentV4): string[] {
  return [...new Set(findQuotes(doc).map((q) => q.sourceId))].slice(0, QUOTE_SOURCES_MAX);
}

/** One source's notes as evidence; a proof without a note gives nothing. */
export function evidenceOf(read: ProofsRead & { kind: "ok" }): SourceEvidence {
  const notes = read.proofs.map((p) => p.note?.trim() ?? "").filter((n) => n.length > 0).map((text) => ({ text }));
  return { proofs: [], notes };
}

/**
 * The evidence for the quoted sources. A source that cannot be read is left out (its quotes get no verdict,
 * never a mismatch). Null when nothing could be read at all, or the session ended: the card then says the
 * comparison is unavailable instead of judging against nothing.
 */
export async function loadQuoteEvidence(sourceIds: readonly string[], list: (sourceId: string) => Promise<ProofsRead>): Promise<EvidenceBySource | null> {
  if (sourceIds.length === 0) return {};
  const reads = await Promise.all(sourceIds.map(async (id) => {
    try { return [id, await list(id)] as const; } catch { return [id, { kind: "nepoznato" } as ProofsRead] as const; }
  }));
  if (reads.some(([, r]) => r.kind === "session-expired")) return null;
  const evidence: Record<string, SourceEvidence> = {};
  for (const [id, read] of reads) if (read.kind === "ok") evidence[id] = evidenceOf(read);
  return Object.keys(evidence).length === 0 ? null : evidence;
}
