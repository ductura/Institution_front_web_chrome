// PIL-P1-PODUDARANJE-EDITOR: the student's read of the assistant matches over the real route.
// Invented ids only.
import { describe, expect, it, vi } from "vitest";

import { createAssistantMatchCall, segmentsOf, type MatchFinding } from "./assistant-match";

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
