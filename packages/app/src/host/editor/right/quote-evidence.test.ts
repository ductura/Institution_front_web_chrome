import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import type { ProofsRead, SourceProof } from "../../../../../../src/client/source-proofs";
import type { CanonicalDocumentV4, NodeId } from "../../../../../editor-core/src/document/document/index.ts";
import { reviewQuotes } from "../stem/quote-review";

import { evidenceOf, loadQuoteEvidence, QUOTE_SOURCES_MAX, quotedSources } from "./quote-evidence";

// ED-40 (P2-11), option 1: the quote check against the student's notes. Invented work, sources and notes.
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}` as NodeId;
const t = (text: string) => ({ type: "text" as const, text, marks: [] });
const QUOTE = "Svaka pojava ima svoj uzrok u prethodnoj pojavi";
const cite = (sourceId: string) => ({ type: "citation" as const, sourceId: sourceId as never, locator: "12" });
const doc: CanonicalDocumentV4 = {
  schemaVersion: 4,
  sources: [],
  nodes: [
    { type: "paragraph", id: id(1), children: [t(`Autorica piše: „${QUOTE}” `), cite("s1")] },
    { type: "paragraph", id: id(2), children: [t(`Opet: „${QUOTE}” `), cite("s1"), t(` i „Druga dovoljno duga rečenica navoda” `), cite("s2")] },
    { type: "paragraph", id: id(3), children: [t("Bez navoda "), cite("s3")] },
  ],
};
const proof = (sourceId: string, note: string | null): SourceProof => ({
  id: "p", sourceId, page: "12", note, imagePath: "/x",
}) as SourceProof;
const ok = (...proofs: SourceProof[]): ProofsRead => ({ kind: "ok", proofs });

describe("quotedSources", () => {
  it("names each source cited after a literal quote once, and no other", () => {
    expect(quotedSources(doc)).toEqual(["s1", "s2"]);
  });
  it("reads at most QUOTE_SOURCES_MAX sources", () => {
    const many: CanonicalDocumentV4 = { ...doc, nodes: Array.from({ length: QUOTE_SOURCES_MAX + 5 }, (_, i) => ({ type: "paragraph" as const, id: id(i + 10), children: [t(`„${QUOTE}” `), cite(`s${i}`)] })) };
    expect(quotedSources(many)).toHaveLength(QUOTE_SOURCES_MAX);
  });
});

describe("evidenceOf", () => {
  it("takes the notes only; a proof is an image without text", () => {
    expect(evidenceOf(ok(proof("s1", ` ${QUOTE}, kaže autorica. `), proof("s1", null), proof("s1", "  ")) as ProofsRead & { kind: "ok" }))
      .toEqual({ proofs: [], notes: [{ text: `${QUOTE}, kaže autorica.` }] });
  });
});

describe("loadQuoteEvidence", () => {
  it("reads each quoted source once and compares quotes with the notes", async () => {
    const list = vi.fn(async (sourceId: string) => (sourceId === "s1" ? ok(proof("s1", `Na str. 12: ${QUOTE}.`)) : ok()));
    const evidence = await loadQuoteEvidence(quotedSources(doc), list);
    expect(list.mock.calls.map(([s]) => s)).toEqual(["s1", "s2"]);
    const review = reviewQuotes(doc, evidence!);
    expect(review.checked).toBe(2);
    expect(review.confirmed).toBe(2);
  });

  it("leaves out a source that cannot be read, so its quotes get no verdict", async () => {
    const evidence = await loadQuoteEvidence(["s1", "s2"], async (s) => (s === "s1" ? ok(proof("s1", `Bilješka: ${QUOTE}.`)) : { kind: "greska", code: "not_found" }));
    expect(Object.keys(evidence!)).toEqual(["s1"]);
    expect(reviewQuotes(doc, evidence!).quotes.find((q) => q.found.sourceId === "s2")!.verdict).toEqual({ kind: "none" });
  });

  it("is null when nothing can be read or the session has ended, and empty with nothing to read", async () => {
    expect(await loadQuoteEvidence(["s1"], async () => ({ kind: "nepoznato" }))).toBeNull();
    expect(await loadQuoteEvidence(["s1"], async () => { throw new Error("mreža"); })).toBeNull();
    expect(await loadQuoteEvidence(["s1", "s2"], async (s) => (s === "s1" ? ok() : { kind: "session-expired" }))).toBeNull();
    expect(await loadQuoteEvidence([], async () => ok())).toEqual({});
  });
});

describe("Provjere wiring (ED-40)", () => {
  const group = readFileSync(join(__dirname, "PregledGroup.tsx"), "utf8");
  const host = readFileSync(join(__dirname, "PregledHost.tsx"), "utf8");
  it("mounts the quote card under Provjere with notes read through the existing proofs route", () => {
    expect(group).toContain("<QuoteReviewCard");
    expect(group).toContain("listProofs(assignmentId, sourceId)");
    expect(host).toContain("assignmentId={assignmentId}");
  });
});
