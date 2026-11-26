import { describe, expect, it } from "vitest";

import type { OpenOutcome } from "../../../../../../src/client/evidence-ingest.ts";
import {
  slidesRevisionZeroDocument, slidesSnapshotBytes, slidesSnapshotSha256, type SlidesDocument,
} from "../../../../../editor-core/src/slides/index.ts";
import { checkSlides, readSlidesWork } from "./requirements.ts";

// Every document is invented.
const slide = (n: number) => ({
  id: `00000000-0000-4000-8000-00000000010${n}`, layout: "titleContent" as const,
  blocks: [{ type: "heading" as const, id: `00000000-0000-4000-8000-00000000020${n}`, slot: "title" as const, text: `Izmišljeni naslov ${n}` }],
});
const deck = (n: number): SlidesDocument => ({ documentKind: "slides", schemaVersion: 1, slides: Array.from({ length: n }, (_, i) => slide(i)) });

describe("checkSlides", () => {
  it("revision zero is no work: sending stays closed", () => {
    expect(checkSlides(slidesRevisionZeroDocument()).kind).toBe("empty");
    expect(checkSlides({ ...deck(1), slides: [] }).kind).toBe("empty");
  });
  it("without a range any written work passes", () => {
    expect(checkSlides(deck(3))).toEqual({ kind: "ok", count: 3 });
  });
  it("fewer slides than the minimum and more than the maximum are refused with the counts", () => {
    expect(checkSlides(deck(2), { min: 5, max: null })).toEqual({ kind: "tooFew", count: 2, min: 5 });
    expect(checkSlides(deck(7), { min: null, max: 6 })).toEqual({ kind: "tooMany", count: 7, max: 6 });
    expect(checkSlides(deck(5), { min: 5, max: 5 })).toEqual({ kind: "ok", count: 5 });
  });
  it("a range that cannot be right is not trusted, and does not pass as a number", () => {
    for (const range of [{ min: 6, max: 5 }, { min: 0, max: null }, { min: 1.5, max: null }, { min: null, max: 101 }, { min: Number.NaN, max: null }]) {
      expect(checkSlides(deck(3), range).kind, JSON.stringify(range)).toBe("unreadableRange");
    }
  });
});

const ID = "izmisljeni-dokument-1";
async function opened(doc: SlidesDocument, extra: object = {}): Promise<OpenOutcome> {
  return {
    status: "opened",
    work: {
      documentId: ID, evidenceProfileId: "p", currentRevision: 4, documentHash: await slidesSnapshotSha256(doc), headSegmentHash: null,
      lastSequenceTo: 3, document: slidesSnapshotBytes(doc), evidenceDomainId: "d", receiptKeys: [], submitted: false, documentKind: "slides", ...extra,
    },
  } as OpenOutcome;
}

describe("readSlidesWork", () => {
  it("a verified slides snapshot is the work as the server confirmed it", async () => {
    const read = await readSlidesWork(await opened(deck(2)));
    expect(read).toMatchObject({ kind: "ready", documentId: ID, revision: 4, submitted: false });
    expect(read.kind === "ready" && read.document.slides.length).toBe(2);
  });
  it("a snapshot whose hash is not the server's is never shown or sent", async () => {
    expect((await readSlidesWork(await opened(deck(2), { documentHash: "0".repeat(64) }))).kind).toBe("unavailable");
  });
  it("a text work is not submitted by the slides step", async () => {
    expect((await readSlidesWork(await opened(deck(2), { documentKind: undefined }))).kind).toBe("notSlides");
  });
  it("another person's, an unknown work and a closed sign-in each have their own answer; no answer is unavailable, never empty", async () => {
    expect((await readSlidesWork({ status: "not_found" })).kind).toBe("notFound");
    expect((await readSlidesWork({ status: "not_accepting" })).kind).toBe("notFound");
    expect((await readSlidesWork({ status: "unauthenticated" })).kind).toBe("signedOut");
    expect((await readSlidesWork({ status: "unavailable", offline: true })).kind).toBe("unavailable");
    expect((await readSlidesWork({ status: "upgrade_required" })).kind).toBe("unavailable");
  });
  it("a submitted work says so", async () => {
    expect(await readSlidesWork(await opened(deck(2), { submitted: true }))).toMatchObject({ kind: "ready", submitted: true });
  });
});
