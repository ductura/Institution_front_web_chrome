import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import MarkedText from "./MarkedText";
import { ProvenanceMapView } from "./ProvenanceMap";
import { excerpt, nextMark, placeRanges, textBlocksOfDocument, type OriginRange } from "./marked-text";
import { DEFAULT_SWITCHES } from "./model";
import { markedTextMessages as t } from "./text-messages.hr";
import { markedTextReader, type TextState } from "./text-read";

// Invented work and text; no real person or text.
const ORIGIN = "https://ductura.example.invalid";
const DOCUMENT = "izmisljeni-rad-1";
const H = "00000000-0000-4000-8000-0000000000b1";
const P1 = "00000000-0000-4000-8000-0000000000b2";
const P2 = "00000000-0000-4000-8000-0000000000b3";
const DOC = {
  schemaVersion: 3,
  nodes: [
    { type: "heading", id: H, level: 1, children: [{ type: "text", text: "Uvod", marks: [] }] },
    { type: "paragraph", id: P1, children: [
      { type: "text", text: "Prva rečenica. ", marks: [] },
      { type: "citation", sourceId: "00000000-0000-4000-8000-0000000000f1" },
      { type: "text", text: "Druga rečenica čćž.", marks: [] },
    ] },
    { type: "box", id: "kutija", children: [{ type: "paragraph", id: P2, children: [{ type: "text", text: "U kutiji 🙂 tekst.", marks: [] }] }] },
  ],
};
const range = (blockId: string, start: number, end: number, kind: OriginRange["kind"], segmentRef: string | null = null): OriginRange =>
  ({ blockId, start, end, kind, segmentRef });
const RANGES = [
  range(P1, 0, 15, "typed"),
  range(P1, 15, 34, "pasted_unknown"),
  range(P2, 9, 10, "assistant_inserted", "odsjecak-1"),
];

describe("PG-2 marked text: model", () => {
  it("reads the text blocks as the server counts them: text children only, a box walked in place", () => {
    expect(textBlocksOfDocument(DOC)).toEqual([
      { id: H, heading: true, text: "Uvod" },
      { id: P1, heading: false, text: "Prva rečenica. Druga rečenica čćž." },
      { id: P2, heading: false, text: "U kutiji 🙂 tekst." },
    ]);
    expect(textBlocksOfDocument({ nodes: "nije popis" })).toBeNull();
    expect(textBlocksOfDocument(null)).toBeNull();
  });

  it("splits a block at the ranges in code points and numbers the marks in reading order, typed text unnumbered", () => {
    const text = placeRanges(4, textBlocksOfDocument(DOC) ?? [], RANGES);
    expect(text.blocks[1]).toEqual({ id: P1, heading: false, typed: false, runs: [
      { kind: "typed", text: "Prva rečenica. ", mark: null },
      { kind: "pasted_unknown", text: "Druga rečenica čćž.", mark: 1 },
    ] });
    // The emoji is one code point (two UTF-16 units): the range 9..10 is exactly it.
    expect(text.blocks[2]?.runs).toEqual([
      { kind: null, text: "U kutiji " }, { kind: "assistant_inserted", text: "🙂", mark: 2 }, { kind: null, text: " tekst." },
    ]);
    expect(text.marks.map((m) => [m.mark, m.kind, m.block])).toEqual([[1, "pasted_unknown", 2], [2, "assistant_inserted", 3]]);
    expect(text.skipped).toBe(0);
  });

  it("calls a block typed only when typed ranges cover all of it", () => {
    const blocks = textBlocksOfDocument(DOC) ?? [];
    const whole = placeRanges(4, blocks, [range(H, 0, 2, "typed"), range(H, 2, 4, "typed"), range(P1, 0, 15, "typed")]);
    expect(whole.blocks.map((b) => b.typed)).toEqual([true, false, false]);
  });

  it("leaves out and counts a range of an unknown block, past the end, empty or overlapping; never guesses", () => {
    const text = placeRanges(4, textBlocksOfDocument(DOC) ?? [], [
      range("00000000-0000-4000-8000-00000000dead", 0, 2, "pasted_unknown"),
      range(H, 0, 5, "pasted_unknown"),
      range(P1, 0, 10, "imported_file"),
      range(P1, 5, 12, "pasted_known"),
      range(P2, 3, 3, "imported_file"),
    ]);
    expect(text.skipped).toBe(4);
    expect(text.marks.map((m) => m.kind)).toEqual(["imported_file"]);
    expect(text.blocks[0]?.runs).toEqual([{ kind: null, text: "Uvod" }]);
  });

  it("steps to the next mark and back to the first after the last", () => {
    expect([nextMark(0, 3), nextMark(1, 3), nextMark(3, 3), nextMark(0, 0)]).toEqual([1, 2, 1, 0]);
  });

  it("shortens a long segment at a word for the list", () => {
    expect(excerpt("kratko")).toBe("kratko");
    expect(excerpt(`${"riječ ".repeat(30)}kraj`, 20)).toBe("riječ riječ riječ…");
  });
});

function reader(answers: Record<string, Response | Error>) {
  const transport = vi.fn<typeof fetch>(async (url) => {
    const path = new URL(String(url)).pathname;
    const answer = answers[path];
    if (answer === undefined) throw new Error(`unexpected ${path}`);
    if (answer instanceof Error) throw answer;
    return answer.clone();
  });
  return { transport, read: markedTextReader({ baseUrl: ORIGIN, fetchImpl: transport }) };
}
const SEGMENTS = `/api/v1/works/${DOCUMENT}/origin-segments`;
const VERSION = `/api/v1/works/${DOCUMENT}/versions/4`;
const json = (status: number, code: string) => Response.json({ code }, { status });

describe("PG-2 marked text: read", () => {
  it("reads the ranges, then the text of exactly their revision", async () => {
    const { transport, read } = reader({
      [SEGMENTS]: Response.json({ revision: 4, segments: RANGES }),
      [VERSION]: Response.json({ revision: 4, document: JSON.stringify(DOC) }),
    });
    const got = await read(DOCUMENT);
    expect(got.kind).toBe("text");
    if (got.kind === "text") expect([got.text.revision, got.text.marks.length]).toEqual([4, 2]);
    expect(transport.mock.calls.map(([url, init]) => [new URL(String(url)).pathname, init?.method])).toEqual([[SEGMENTS, "GET"], [VERSION, "GET"]]);
  });

  it("says no ranges were recorded instead of drawing text without marks", async () => {
    expect(await reader({ [SEGMENTS]: Response.json({ revision: null, segments: [] }) }).read(DOCUMENT)).toEqual({ kind: "noRanges" });
    expect(await reader({ [SEGMENTS]: Response.json({ revision: 3, segments: [] }) }).read(DOCUMENT)).toEqual({ kind: "noRanges" });
  });

  it("maps 401, 404 (someone else's work), 503, a broken answer, another revision and a network failure", async () => {
    expect(await reader({ [SEGMENTS]: json(401, "unauthorized") }).read(DOCUMENT)).toEqual({ kind: "signedOut" });
    expect(await reader({ [SEGMENTS]: json(404, "not_found") }).read(DOCUMENT)).toEqual({ kind: "notFound" });
    expect(await reader({ [SEGMENTS]: json(503, "unavailable") }).read(DOCUMENT)).toEqual({ kind: "unavailable" });
    expect(await reader({ [SEGMENTS]: Response.json({ revision: 4, segments: [{ blockId: P1 }] }) }).read(DOCUMENT)).toEqual({ kind: "unavailable" });
    const ok = Response.json({ revision: 4, segments: RANGES });
    expect(await reader({ [SEGMENTS]: ok, [VERSION]: json(404, "not_found") }).read(DOCUMENT)).toEqual({ kind: "notFound" });
    expect(await reader({ [SEGMENTS]: ok, [VERSION]: Response.json({ revision: 5, document: JSON.stringify(DOC) }) }).read(DOCUMENT)).toEqual({ kind: "unavailable" });
    expect(await reader({ [SEGMENTS]: ok, [VERSION]: Response.json({ revision: 4, document: "{" }) }).read(DOCUMENT)).toEqual({ kind: "unavailable" });
    expect(await reader({ [SEGMENTS]: new Error("offline") }).read(DOCUMENT)).toEqual({ kind: "unavailable" });
    expect(await reader({}).read("")).toEqual({ kind: "notFound" });
  });
});

const READY: TextState = { kind: "text", text: placeRanges(4, textBlocksOfDocument(DOC) ?? [], RANGES) };
const view = (state: TextState, origin = true, typed = false) =>
  renderToStaticMarkup(createElement(MarkedText, { state, origin, typed, onRetry: () => {} }));

describe("PG-2 marked text: view", () => {
  it("names every mark in words next to its line, with who typed and „nije dokaz autorstva” under it", () => {
    const out = view(READY);
    expect(out).toContain(t.markLabel("pasted_unknown", 1));
    expect(out).toContain(t.markLabel("assistant_inserted", 2));
    expect(out).toContain('data-kind="pasted_unknown"');
    for (const text of [t.heading, t.revision(4), t.next, t.whoTyped, t.notProof, t.tableCaption]) expect(out).toContain(text);
    expect(out).toContain("<table");
    expect(out).not.toMatch(/ritam|ms\b|%/i);
    expect(out).not.toContain(t.kind("typed"));
  });

  it("labels typed text only while „Napisano u Ducturi” is on; origin off turns the sheet and the step off", () => {
    expect(view(READY, true, true)).toContain(t.kind("typed"));
    expect(view(READY, true, false)).not.toContain(t.kind("typed"));
    const off = view(READY, false, false);
    expect(off).toContain('data-origin="off"');
    expect(off.match(/<button[^>]*data-next-mark[^>]*>/)?.[0]).toContain("disabled");
  });

  // A paragraph of a typed and a pasted range: the typed words follow the typed range only, the paragraph carries no
  // typed line, and the pasted range keeps its own words (the display never claims more than the record).
  it("marks only the typed range of a mixed paragraph as typed, never the whole paragraph", () => {
    const out = view(READY, true, true);
    const paragraph = out.match(new RegExp(`<p data-block="${P1}"[^>]*>.*?</p>`))?.[0] ?? "";
    expect(paragraph).not.toMatch(/class="[^"]*pvTyped/);
    expect(paragraph).toMatch(/<span data-kind="typed">Prva rečenica\. <\/span><span[^>]*data-typed-label[^>]*>napisano u Ducturi<\/span>/);
    expect(paragraph.match(/data-typed-label/g)).toHaveLength(1);
    expect(paragraph).toMatch(/data-kind="pasted_unknown"[^>]*>Druga rečenica čćž\.<\/span><span[^>]*>zalijepljeno · izvor nije opažen · oznaka 1</);
    const whole = renderToStaticMarkup(createElement(MarkedText, { state: { kind: "text", text: placeRanges(4, [{ id: "t", heading: false, text: "Sve tipkano." }], [range("t", 0, 12, "typed")]) },
      origin: true, typed: true, onRetry: () => {} }));
    expect(whole).toMatch(/<p data-block="t" class="[^"]*pvTyped[^"]*">Sve tipkano\.<span[^>]*data-typed-label/);
  });

  it("shows loading, an error with retry, no ranges, not found and signed out", () => {
    expect(view({ kind: "loading" })).toContain(t.loading);
    expect(view({ kind: "unavailable" })).toContain(t.retry);
    expect(view({ kind: "noRanges" })).toContain("još nije dostupan");
    expect(view({ kind: "notFound" })).toContain("Rad nije pronađen.");
    expect(view({ kind: "signedOut" })).toContain("Sesija je istekla.");
    for (const kind of ["loading", "noRanges", "notFound", "signedOut", "unavailable"] as const) expect(view({ kind })).not.toContain("<table");
  });

  it("is drawn in the map only when the work has marks", () => {
    const map = (kind: "marked" | "noMarks") => renderToStaticMarkup(createElement(ProvenanceMapView, {
      state: { kind }, switches: DEFAULT_SWITCHES, onSwitches: () => {}, onRetry: () => {}, text: READY,
    }));
    expect(map("marked")).toContain(t.heading);
    expect(map("noMarks")).not.toContain(t.heading);
  });
});
