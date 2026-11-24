// PIL-P1-PODUDARANJE-EDITOR: the student's read of the assistant matches over the real route.
// Invented ids only.
import { describe, expect, it, vi } from "vitest";

import { createAssistantMatchCall, createSegmentCheck, segmentsOf, type MatchFinding } from "./assistant-match";

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
      { segmentId: "p-1", conversationId: "c-2", messageId: "m-14", words: 14, attachedAt: "2026-11-20T11:00:00.000Z" },
      { segmentId: "p-2", conversationId: "c-3", messageId: "m-8", words: 8, attachedAt: "2026-11-20T10:01:00.000Z" },
    ]);
  });

  it("carries the latest explanation the student wrote for the segment (ED-13)", () => {
    const at = "2026-11-20T10:00:00.000Z";
    expect(segmentsOf([
      { ...finding("p-1", 9, at), explanation: { text: "Prvo.", writtenAt: "2026-11-20T12:00:00.000Z" } },
      { ...finding("p-1", 12, at), explanation: null },
      { ...finding("p-1", 8, at), explanation: { text: "Drugo.", writtenAt: "2026-11-20T13:00:00.000Z" } },
    ])).toEqual([{ segmentId: "p-1", conversationId: "c-1", messageId: "m-12", words: 12, attachedAt: at, explanation: { text: "Drugo.", at: "2026-11-20T13:00:00.000Z" } }]);
  });
});

describe("the match port over the server", () => {
  it("reads the findings of this work as the notice's matches", async () => {
    const call = vi.fn(async () => ({ ok: true as const, status: 200 as const, headers: {}, body: { findings: [finding("p-1", 9, "2026-11-20T10:00:00.000Z")] } }));
    const port = createAssistantMatchCall(call as never);
    const answer = await port("work.assistant-match.get", { params: { documentId: DOC } });
    expect(call).toHaveBeenCalledWith("work.assistant-match.get", { params: { documentId: DOC }, query: undefined, body: undefined });
    expect(answer).toEqual({ ok: true, status: 200, body: { enabled: true, matches: [{ segmentId: "p-1", conversationId: "c-1", messageId: "m-9", words: 9, attachedAt: "2026-11-20T10:00:00.000Z" }] } });
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

  it("sends an explanation to its own route with the answer it explains (ED-13)", async () => {
    const call = vi.fn(async () => ({ ok: true as const, status: 201 as const, headers: {}, body: { text: "Objašnjenje.", writtenAt: "2026-11-20T12:00:00.000Z" } }));
    const answer = await createAssistantMatchCall(call as never)("work.assistant-match.explain", { params: { documentId: DOC, segmentId: "p-1" }, body: { text: "Objašnjenje.", messageId: "m-9" } });
    expect(call).toHaveBeenCalledWith("work.assistant-match-explanation.post", { params: { documentId: DOC }, query: undefined, body: { segmentRef: "p-1", messageId: "m-9", text: "Objašnjenje." } });
    expect(answer).toEqual({ ok: true, status: 201, body: { text: "Objašnjenje.", at: "2026-11-20T12:00:00.000Z" } });
  });

  it("passes a refused explanation on as it came", async () => {
    const call = vi.fn(async () => ({ ok: false as const, status: 409, code: "conflict" }));
    expect(await createAssistantMatchCall(call as never)("work.assistant-match.explain", { params: { documentId: DOC, segmentId: "p-1" }, body: { text: "x", messageId: "m-9" } }))
      .toEqual({ ok: false, status: 409, code: "conflict" });
  });
});

describe("createSegmentCheck", () => {
  it("sends exactly the segment to work.assistant-match.post and counts the matches", async () => {
    const call = vi.fn(async () => ({
      ok: true as const,
      status: 200,
      body: { matches: [{ messageId: "m1", conversationId: "c1", runWords: 9 }, { messageId: "m2", conversationId: "c1", runWords: 8 }] },
    }));
    const check = createSegmentCheck(call as never);
    const answer = await check("doc-1", { segmentRef: "node-1", text: "Izmišljeni odlomak." });
    expect(answer).toEqual({ ok: true, matched: 2 });
    expect(call).toHaveBeenCalledWith("work.assistant-match.post", {
      params: { documentId: "doc-1" },
      query: undefined,
      body: { segmentRef: "node-1", text: "Izmišljeni odlomak." },
    });
  });

  it("passes a refusal through", async () => {
    const call = vi.fn(async () => ({ ok: false as const, status: 422, code: "invalid_input" }));
    expect(await createSegmentCheck(call as never)("doc-1", { segmentRef: "n", text: "x" })).toEqual({ ok: false, status: 422, code: "invalid_input" });
  });
});
