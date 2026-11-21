import type { ProvenancePort, ProvenanceRead, ShareCategory, ShareRecord } from "./provenance";

/** The contract proposal's fixed category order (1.2). */
const CATEGORIES: readonly ShareCategory[] = ["written", "ai_transferred", "pasted", "imported", "unattributed"];

/** A share record in the category order of the contract proposal; all numbers are invented. */
export function fakeShare(points: readonly number[], percents: readonly number[]): ShareRecord {
  return {
    unit: "code_point",
    totalCodePoints: points.reduce((a, b) => a + b, 0),
    categories: CATEGORIES.map((category, i) => ({ category, codePoints: points[i] ?? 0, percent: percents[i] ?? 0 })),
    notice: "not_authorship_evidence",
  };
}

/** Invented text. The numbers follow vector 9.1 of the SRV-1220 proposal (T = 365). */
export const VECTOR_9_1: ProvenanceRead = {
  kind: "ready",
  share: fakeShare([195, 64, 63, 34, 9], [53, 18, 17, 9, 3]),
  blocks: [
    { id: "b1", text: "Kućno kompostiranje smanjuje količinu otpada. Kompost nastaje razgradnjom organske tvari." },
    { id: "b2", text: "Proces obično traje nekoliko mjeseci." },
  ],
  aiMatch: {
    normalization: "ductura-match-norm-v1",
    minMatchCodePoints: 60,
    spans: [{ blockId: "b1", from: 46, to: 89 }],
    notice: "not_authorship_evidence",
  },
};

/**
 * The only ProvenancePort until SRV-1220 is approved: used by tests and both submission screens.
 * A submission it does not hold reads as `fallback`, or as `none` when there is no fallback.
 * Each read is a fresh copy, so a caller cannot change what the next reader gets.
 */
export function createFakeProvenance(
  records: Readonly<Record<string, ProvenanceRead>>,
  fallback?: ProvenanceRead,
): ProvenancePort {
  return {
    async read(submissionId) {
      const found = Object.hasOwn(records, submissionId) ? records[submissionId] : fallback;
      return found ? structuredClone(found) : { kind: "none" };
    },
  };
}

/** What both submission screens read until the route exists: the same invented record for any work. */
export const screenProvenance: ProvenancePort = createFakeProvenance({}, VECTOR_9_1);
