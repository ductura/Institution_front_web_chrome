// WEB-V13-PREDAJA: what a slides work is checked against before it is sent, and the read of the
// work as the server confirmed it. Pure and without a network: the open answer comes in as an argument.
//
// The slide range of an assignment is not in the published contract yet (student.assignment-requirements.get
// gives only `wordRange`), so the range is an input that is `null` until the contract carries it; nothing
// here invents a field. The server's own check on submission stays the one that decides.
import type { OpenOutcome } from "../../../../../../src/client/evidence-ingest.ts";
import {
  MAX_SLIDES, slidesDocumentsEqual, slidesRevisionZeroDocument, verifySlidesSnapshot, type SlidesDocument,
} from "../../../../../editor-core/src/slides/index.ts";

export type SlideRange = { readonly min: number | null; readonly max: number | null } | null;

/** What the check found: `ok`, or the one reason sending stays closed (the message is the page's). */
export type SlidesCheck =
  | { readonly kind: "ok"; readonly count: number }
  | { readonly kind: "empty" }
  | { readonly kind: "tooFew"; readonly count: number; readonly min: number }
  | { readonly kind: "tooMany"; readonly count: number; readonly max: number }
  | { readonly kind: "unreadableRange" };

const isCount = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 1 && n <= MAX_SLIDES;

/** A range with a bound that is not a count, or with min above max, is not trusted: `unreadableRange`. */
export function checkSlides(doc: SlidesDocument, range: SlideRange = null): SlidesCheck {
  const count = doc.slides.length;
  // Revision zero (one empty title slide) is no work: nothing was written yet.
  if (count === 0 || slidesDocumentsEqual(doc, slidesRevisionZeroDocument())) return { kind: "empty" };
  if (range === null) return { kind: "ok", count };
  const { min, max } = range;
  if ((min !== null && !isCount(min)) || (max !== null && !isCount(max)) || (min !== null && max !== null && min > max)) {
    return { kind: "unreadableRange" };
  }
  if (min !== null && count < min) return { kind: "tooFew", count, min };
  if (max !== null && count > max) return { kind: "tooMany", count, max };
  return { kind: "ok", count };
}

/** The slides work as the server confirmed it (evidence.open.post), or why there is none to show. */
export type SlidesWorkRead =
  | { readonly kind: "ready"; readonly documentId: string; readonly revision: number; readonly document: SlidesDocument; readonly submitted: boolean }
  /** The sign-in ended. */
  | { readonly kind: "signedOut" }
  /** Another person's, an unknown or a not accepting work: the same "not found" for all. */
  | { readonly kind: "notFound" }
  /** The work is not a slides work: this page does not submit it. */
  | { readonly kind: "notSlides" }
  /** No answer, an answer this client cannot vouch for, or an old client: sending stays closed. */
  | { readonly kind: "unavailable" };

/** Reads the open answer: only a verified slides snapshot is ever shown or sent (contract slides-v1 §7). */
export async function readSlidesWork(outcome: OpenOutcome): Promise<SlidesWorkRead> {
  switch (outcome.status) {
    case "unauthenticated": return { kind: "signedOut" };
    case "not_found":
    case "not_accepting": return { kind: "notFound" };
    case "opened": {
      const { work } = outcome;
      if (work.documentKind !== "slides") return { kind: "notSlides" };
      const snapshot = await verifySlidesSnapshot(work.document).catch(() => null);
      if (snapshot === null || !snapshot.ok || snapshot.sha256 !== work.documentHash) return { kind: "unavailable" };
      return { kind: "ready", documentId: work.documentId, revision: work.currentRevision, document: snapshot.document, submitted: work.submitted };
    }
    default: return { kind: "unavailable" };
  }
}
