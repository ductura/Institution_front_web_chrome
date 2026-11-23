// PIL-P1-PODUDARANJE-EDITOR: the student's read of the assistant matches over the real route.
// Invented ids only.
import { describe, expect, it, vi } from "vitest";

import { changedSegments, createAssistantMatchCall, createSegmentPort, MAX_SEGMENT_TEXT, segmentsOf, sendable, type MatchFinding } from "./assistant-match";

const DOC = "0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d01";
const finding = (segmentRef: string, runWords: number, attachedAt: string, conversationId = "c-1"): MatchFinding => ({
  segmentRef, conversationId, messageId: `m-${runWords}`, runWords, recordedAt: attachedAt, attachedAt,
});

describe("segmentsOf", () => {
  it("folds the findings of a segment into one item: its longest run and latest attachment", () => {
    expect(segmentsOf([
      finding("p-1", 9, "2026-11-20T10:00:00.000Z", "c-1"),
      finding("p-2", 8, "2026-11-20T10:01:00.000Z", "c-3"),
      finding("p-1", 14, "2026-11-20T09:00:00.000Z", "c-2"),
      finding("p-1", 8, "2026-11-20T11:00:00.000Z", "c-4"),
    ])).toEqual([
      { segmentId: "p-1", conversationId: "c-2", words: 14, attachedAt: "2026-11-20T11:00:00.000Z" },
      { segmentId: "p-2", conversationId: "c-3", words: 8, attachedAt: "2026-11-20T10:01:00.000Z" },
    ]);
  });
});

describe("the match port over the server", () => {
  it("reads the findings of this work as the notice's matches", async () => {
    const call = vi.fn(async () => ({ ok: true as const, status: 200 as const, headers: {}, body: { findings: [finding("p-1", 9, "2026-11-20T10:00:00.000Z")] } }));
    const port = createAssistantMatchCall(call as never);
    const answer = await port("work.assistant-match.get", { params: { documentId: DOC } });
    expect(call).toHaveBeenCalledWith("work.assistant-match.get", { params: { documentId: DOC }, query: undefined, body: undefined });
    expect(answer).toEqual({ ok: true, status: 200, body: { enabled: true, matches: [{ segmentId: "p-1", conversationId: "c-1", words: 9, attachedAt: "2026-11-20T10:00:00.000Z" }] } });
  });

  it("with the switch off the server stores no finding, so there is nothing to show", async () => {
    const call = vi.fn(async () => ({ ok: true as const, status: 200 as const, headers: {}, body: { findings: [] } }));
    const answer = await createAssistantMatchCall(call as never)("work.assistant-match.get", { params: { documentId: DOC } });
    expect(answer).toEqual({ ok: true, status: 200, body: { enabled: true, matches: [] } });
  });

  it("passes a refusal on as it came", async () => {
    const call = vi.fn(async () => ({ ok: false as const, status: 401, code: "unauthorized" }));
    expect(await createAssistantMatchCall(call as never)("work.assistant-match.get", { params: { documentId: DOC } }))
      .toEqual({ ok: false, status: 401, code: "unauthorized" });
  });

  it("never sends an explanation: the server has no route for it", async () => {
    const call = vi.fn();
    const answer = await createAssistantMatchCall(call as never)("work.assistant-match.explain", { params: { documentId: DOC, segmentId: "p-1" }, body: { text: "x" } });
    expect(answer).toEqual({ ok: false, status: 404, code: "not_found" });
    expect(call).not.toHaveBeenCalled();
  });
});

describe("the paragraphs the editor sends (PIL-P1-PODUDARANJE-PROVJERA-WEB)", () => {
  const LONG = "Ovo je izmišljeni odlomak od najmanje osam riječi za provjeru.";

  it("a paragraph shorter than eight words can never match and is not sent", () => {
    expect(sendable({ ref: "p-1", text: "Samo sedam riječi u ovom kratkom odlomku." })).toBeNull();
    expect(sendable({ ref: "p-1", text: LONG })).toEqual({ ref: "p-1", text: LONG });
  });

  it("a block id the route would refuse is not sent", () => {
    expect(sendable({ ref: "", text: LONG })).toBeNull();
    expect(sendable({ ref: "x".repeat(129), text: LONG })).toBeNull();
    expect(sendable({ ref: "p\u0007", text: LONG })).toBeNull();
  });

  it("a longer paragraph is cut to the route's limit of characters, never inside a character", () => {
    const text = `${LONG} ${"😀".repeat(MAX_SEGMENT_TEXT)}`;
    const cut = sendable({ ref: "p-1", text });
    expect(Array.from(cut?.text ?? "")).toHaveLength(MAX_SEGMENT_TEXT);
    expect(cut?.text.endsWith("😀")).toBe(true);
  });

  it("only the paragraphs whose text changed since they were last known", () => {
    const known = new Map([["p-1", LONG], ["p-2", LONG]]);
    const changed = `${LONG} I još jedna rečenica.`;
    expect(changedSegments([
      { ref: "p-1", text: LONG },
      { ref: "p-2", text: changed },
      { ref: "p-3", text: LONG },
      { ref: "p-4", text: "Kratko." },
    ], known)).toEqual([{ ref: "p-2", text: changed }, { ref: "p-3", text: LONG }]);
  });

  it("posts the block id and its text, and counts the matches of the answer", async () => {
    const call = vi.fn(async () => ({ ok: true as const, status: 200 as const, headers: {}, body: { matches: [{ messageId: "m-1", conversationId: "c-1", runWords: 9 }] } }));
    const answer = await createSegmentPort(call as never)(DOC, { ref: "p-1", text: LONG });
    expect(call).toHaveBeenCalledWith("work.assistant-match.post", { params: { documentId: DOC }, query: undefined, body: { segmentRef: "p-1", text: LONG } });
    expect(answer).toEqual({ kind: "checked", matches: 1 });
  });

  it("answers a paragraph that cannot match without a request", async () => {
    const call = vi.fn();
    expect(await createSegmentPort(call as never)(DOC, { ref: "p-1", text: "Kratko." })).toEqual({ kind: "checked", matches: 0 });
    expect(call).not.toHaveBeenCalled();
  });

  it("reads a refusal as signed out, off or failed, and never throws", async () => {
    const answer = (result: unknown) => createSegmentPort(vi.fn(async () => result) as never)(DOC, { ref: "p-1", text: LONG });
    expect(await answer({ ok: false, status: 401, code: "unauthorized" })).toEqual({ kind: "signedOut" });
    expect(await answer({ ok: false, status: 404, code: "not_found" })).toEqual({ kind: "off" });
    expect(await answer({ ok: false, status: 503, code: "unavailable" })).toEqual({ kind: "failed" });
    expect(await answer({ ok: false, status: 0, code: "network" })).toEqual({ kind: "failed" });
    const thrown = createSegmentPort(vi.fn(async () => { throw new Error("offline"); }) as never);
    expect(await thrown(DOC, { ref: "p-1", text: LONG })).toEqual({ kind: "failed" });
  });
});
