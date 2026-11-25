import { describe, expect, it } from "vitest";

import { PROOF_IMAGE_MAX_BYTES, type ProofDraft, type SourceProof } from "../../../../client/source-proofs";

import { findForbiddenTerms } from "../../../../../scripts/forbidden-terms/terms";
import { dragRect, encodeCut, fitSide, MIN_SELECTION, nudgeRect, outputSize, toSource, type Encoder, type ProofPicture, type Rect, type Size } from "./crop";
import { proofsHr } from "./messages.hr";
import { captureReducer, fieldErrors, quoteNotice, saveCapture, startCapture, type Capture } from "./proof-draft";
import { citedWithProof, documentCitations, documentSources, firstPage, proofsForCitation, sourceLabel } from "./proof-sources";
import { judgeQuote, normalizeQuote, quoteRect, searchQuote, type TextRun } from "./quote-match";

// Invented identifiers and texts only.
const A = "11111111-1111-4111-8111-111111111111";
const S1 = "22222222-2222-4222-8222-222222222222";
const S2 = "44444444-4444-4444-8444-444444444444";
const proof = (id: string, sourceId: string, page: string): SourceProof => ({
  id, sourceId, page, note: null,
  imagePath: `/api/v1/student/assignments/${A}/sources/${sourceId}/proofs/${id}/image`,
});

describe("crop", () => {
  const bounds: Size = { width: 1000, height: 800 };
  it("makes a frame from a drag in any direction, inside the picture", () => {
    expect(dragRect({ x: 300, y: 200 }, { x: 100, y: 50 }, bounds)).toEqual({ x: 100, y: 50, width: 200, height: 150 });
    expect(dragRect({ x: 900, y: 700 }, { x: 1200, y: 900 }, bounds)).toEqual({ x: 900, y: 700, width: 100, height: 100 });
  });
  it("treats a drag under 12 px as a click", () => {
    expect(dragRect({ x: 10, y: 10 }, { x: 10 + MIN_SELECTION - 1, y: 80 }, bounds)).toBeNull();
  });
  it("moves and grows a frame by keys within the picture", () => {
    const rect = { x: 900, y: 10, width: 100, height: 50 };
    expect(nudgeRect(rect, 50, -50, bounds)).toEqual({ x: 900, y: 0, width: 100, height: 50 });
    expect(nudgeRect({ ...rect, x: 0 }, 2000, 0, bounds, true).width).toBe(1000);
  });
  it("scales sizes and frames", () => {
    expect(fitSide({ width: 4400, height: 2200 }, 2200)).toEqual({ width: 2200, height: 1100 });
    expect(fitSide({ width: 400, height: 300 }, 2200)).toEqual({ width: 400, height: 300 });
    expect(outputSize({ width: 2000, height: 500 }, 1000)).toEqual({ width: 1000, height: 250 });
    expect(toSource({ x: 10, y: 10, width: 50, height: 50 }, { width: 100, height: 100 }, { width: 200, height: 400 }))
      .toEqual({ x: 20, y: 40, width: 100, height: 200 });
  });
});

/** A picture that records what was drawn from it, and an encoder that records sizes and qualities. */
function fakes(sizes: number[]) {
  const drawn: Rect[] = [];
  const steps: { size: Size; quality: number }[] = [];
  const picture: ProofPicture = { width: 3000, height: 2000, draw: (_ctx, from) => { drawn.push(from); } };
  let last: Size = { width: 0, height: 0 };
  const encoder: Encoder = {
    canvas: (size) => {
      last = size;
      return { getContext: () => ({ fillRect: () => undefined, fillStyle: "" }) } as unknown as HTMLCanvasElement;
    },
    toBlob: async (_canvas, quality) => {
      steps.push({ size: last, quality });
      const bytes = sizes.shift() ?? 10;
      return new Blob([new Uint8Array(bytes)], { type: "image/jpeg" });
    },
  };
  return { drawn, steps, picture, encoder };
}

describe("encodeCut", () => {
  it("draws only the frame, at most 1000 px wide at 0.72", async () => {
    const { drawn, steps, picture, encoder } = fakes([5000]);
    const frame = { x: 100, y: 200, width: 2000, height: 400 };
    const blob = await encodeCut(picture, frame, encoder);
    expect(blob?.size).toBe(5000);
    expect(drawn).toEqual([frame]);
    expect(steps).toEqual([{ size: { width: 1000, height: 200 }, quality: 0.72 }]);
  });
  it("falls back to 800 px at 0.55, then gives up", async () => {
    const big = fakes([PROOF_IMAGE_MAX_BYTES + 1, 2000]);
    expect((await encodeCut(big.picture, null, big.encoder))?.size).toBe(2000);
    expect(big.steps.map((s) => [s.size.width, s.quality])).toEqual([[1000, 0.72], [800, 0.55]]);
    const huge = fakes([PROOF_IMAGE_MAX_BYTES + 1, PROOF_IMAGE_MAX_BYTES + 1]);
    expect(await encodeCut(huge.picture, null, huge.encoder)).toBeNull();
  });
});

describe("quote against the page (B-8)", () => {
  const page = "Kućno kompostiranje smanjuje količinu otpada u kućanstvu, a pri- mjer iz izmišljenog grada to pokazuje.";
  it("normalises case, quotation marks, punctuation and split words", () => {
    expect(normalizeQuote("„Pri- mjer, IZ grada!”")).toBe("primjer iz grada");
  });
  it("finds the quote word for word", () => {
    expect(judgeQuote("„kućno kompostiranje smanjuje količinu otpada”", page)).toEqual({ kind: "found" });
    expect(judgeQuote("primjer iz izmišljenog grada", page)).toEqual({ kind: "found" });
  });
  it("says the text of the quote differs from the attached page, in those words", () => {
    const judged = judgeQuote("kućno kompostiranje znatno smanjuje količinu otpada", page);
    expect(judged.kind).toBe("differs");
    if (judged.kind === "differs") expect(judged.missing).toEqual(["znatno"]);
    expect(proofsHr.quoteDiffers).toBe("tekst navoda razlikuje se od priložene stranice");
  });
  it("tells a missing quote, a short one and a scanned page apart", () => {
    expect(judgeQuote("posve drukčija rečenica o vremenu", page)).toEqual({ kind: "missing" });
    expect(judgeQuote("kućno", page)).toEqual({ kind: "short" });
    expect(judgeQuote("kućno kompostiranje", "  ")).toEqual({ kind: "scan" });
  });
  it("frames the runs that hold the quote", () => {
    const runs: TextRun[] = [
      { str: "Uvodna rečenica.", x: 10, y: 10, width: 200, height: 20 },
      { str: "Kućno kompostiranje", x: 10, y: 40, width: 180, height: 20 },
      { str: "smanjuje otpad.", x: 200, y: 40, width: 150, height: 20 },
    ];
    expect(quoteRect(runs, "kompostiranje smanjuje otpad", { width: 1000, height: 1000 })).toEqual({ x: 0, y: 24, width: 366, height: 52 });
    expect(quoteRect(runs, "nečega nema ovdje", { width: 1000, height: 1000 })).toBeNull();
  });
  it("looks through the pages: word for word first, else the nearest wording", async () => {
    const pages = ["Prva stranica bez navoda o ničemu.", "Kućno kompostiranje znatno smanjuje otpad u gradu.", "Kućno kompostiranje smanjuje otpad u gradu."];
    const pdf = { count: pages.length, text: async (n: number) => [{ str: pages[n - 1] ?? "", x: 0, y: 0, width: 1, height: 1 }] };
    expect(await searchQuote(pdf, "kućno kompostiranje smanjuje otpad")).toEqual({ kind: "found", page: 3 });
    expect(await searchQuote(pdf, "kućno kompostiranje bitno smanjuje otpad u gradu")).toEqual({ kind: "differs", page: 2 });
    expect(await searchQuote(pdf, "nešto sasvim treće ovdje")).toEqual({ kind: "missing" });
  });
});

describe("sources and citations of the document", () => {
  const doc = {
    type: "doc",
    attrs: {
      sources: [
        { id: S1, type: "book", authors: [{ kind: "person", family: "Izmišljenić", given: "Ana" }], year: 2020, title: "Kompost", place: "Zagreb", publisher: "N" },
        { id: S2, type: "article", authors: [{ kind: "person", family: "Primjerić", given: "Ivo" }, { kind: "person", family: "Uzorak", given: "Eva" }], year: 2019, title: "Otpad", journal: "Č" },
        { id: "nije-uuid", type: "book", authors: [], year: 2000, title: "X" },
      ],
    },
    content: [{ type: "paragraph", content: [
      { type: "text", text: "Tekst " },
      { type: "citation", attrs: { sourceId: S1, locator: "14" } },
      { type: "citation", attrs: { sourceId: S1, locator: "str. 20-22" } },
      { type: "citation", attrs: { sourceId: S2, locator: null } },
    ] }],
  };
  it("lists the sources with a short label, ignoring an id that is not a UUID", () => {
    expect(documentSources(doc)).toEqual([{ id: S1, label: "Izmišljenić (2020)" }, { id: S2, label: "Primjerić i Uzorak (2019)" }]);
    expect(sourceLabel({ authors: [{ kind: "person", family: "A" }, { kind: "person", family: "B" }, { kind: "person", family: "C" }], year: 2001 })).toBe("A i sur. (2001)");
    expect(documentSources({ type: "doc" })).toEqual([]);
  });
  it("puts a proof beside the citation of the same page after the work is opened again", () => {
    const citations = documentCitations(doc);
    expect(citations).toEqual([{ sourceId: S1, page: "14" }, { sourceId: S1, page: "str. 20-22" }, { sourceId: S2, page: null }]);
    // The list as the server gives it on the next opening.
    const listed = [proof("55555555-5555-4555-8555-555555555555", S1, "14"), proof("66666666-6666-4666-8666-666666666666", S1, "20")];
    expect(proofsForCitation(listed, citations[0]!).map((p) => p.page)).toEqual(["14"]);
    expect(proofsForCitation(listed, citations[1]!).map((p) => p.page)).toEqual(["20"]);
    expect(proofsForCitation(listed, citations[2]!)).toEqual([]);
    expect(citedWithProof(citations, listed)).toBe(2);
    expect(firstPage("str. 14–16")).toBe("14");
  });
});

describe("the draft and its send", () => {
  const picture: ProofPicture = { width: 2000, height: 1000, draw: () => undefined };
  const frame = { x: 100, y: 100, width: 400, height: 200 };
  const ready = (): Capture => {
    let s = captureReducer(startCapture(S1, "Izmišljenić (2020)"), { type: "picture", picture });
    s = captureReducer(s, { type: "select", selection: frame });
    s = captureReducer(s, { type: "field", field: "page", value: "14" });
    return captureReducer(s, { type: "field", field: "note", value: "uvodni dio" });
  };
  const cut = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 1])], { type: "image/jpeg" });
  const encoder: Encoder = {
    canvas: () => ({ getContext: () => ({ fillRect: () => undefined }) }) as unknown as HTMLCanvasElement,
    toBlob: async () => cut,
  };

  it("sends only the cut-out with the page and note", async () => {
    const sent: { sourceId: string; draft: ProofDraft }[] = [];
    const result = await saveCapture(ready(), {
      assignmentId: A, encoder,
      upload: async (_a, sourceId, draft) => { sent.push({ sourceId, draft }); return { kind: "ok", proof: proof("77777777-7777-4777-8777-777777777777", S1, "14") }; },
    });
    expect(result.status).toBe("saved");
    expect(sent).toEqual([{ sourceId: S1, draft: { image: cut, page: "14", note: "uvodni dio" } }]);
  });

  it("keeps the whole draft when the send fails", async () => {
    for (const [answer, status] of [
      [{ kind: "nepoznato" }, "failed"], [{ kind: "session-expired" }, "expired"],
      [{ kind: "greska", code: "forbidden" }, "refused"], [{ kind: "greska", code: "too_large" }, "tooLarge"],
    ] as const) {
      const before = ready();
      const result = await saveCapture(before, { assignmentId: A, encoder, upload: async () => answer });
      expect(result.status).toBe(status);
      const after = captureReducer(before, { type: "status", status: result.status as typeof status });
      expect(after).toEqual({ ...before, status });
      expect(after.picture).toBe(picture);
      expect(after.selection).toEqual(frame);
    }
  });

  it("sends nothing without a page", async () => {
    let calls = 0;
    const draft = captureReducer(ready(), { type: "field", field: "page", value: " " });
    expect(fieldErrors(draft)).toEqual({ page: "pageRequired" });
    expect((await saveCapture(draft, { assignmentId: A, encoder, upload: async () => { calls += 1; return { kind: "nepoznato" }; } })).status).toBe("invalid");
    expect(calls).toBe(0);
  });

  it("sends nothing while a PDF page is still loading (the picture is the previous page's)", async () => {
    let calls = 0;
    const loading = captureReducer(ready(), { type: "pdfLoading", page: 2, count: 5 });
    expect(loading.picture).toBe(picture);
    const result = await saveCapture(loading, { assignmentId: A, encoder, upload: async () => { calls += 1; return { kind: "nepoznato" }; } });
    expect(result.status).toBe("invalid");
    expect(calls).toBe(0);
  });

  it("judges the quote only on a PDF page", () => {
    const runs = [{ str: "Kućno kompostiranje smanjuje otpad u gradu.", x: 0, y: 0, width: 1, height: 1 }];
    expect(quoteNotice({ quote: "kompostiranje bitno smanjuje otpad u gradu", runs, pdf: { page: 1, count: 1, loading: false } })?.kind).toBe("differs");
    expect(quoteNotice({ quote: "kompostiranje smanjuje otpad", runs, pdf: null })).toBeNull();
  });
});

describe("interface text", () => {
  it("has no forbidden terms", () => {
    for (const text of Object.values(proofsHr)) expect(findForbiddenTerms(text, "hr").map((term) => term.entry)).toEqual([]);
  });
});
