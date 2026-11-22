import { describe, expect, it } from "vitest";

import type { SourceDraft } from "@ductura/ui";

import * as g from "./guidance";

type Answer = { ok: boolean; status: number; body?: unknown };
function fake(answers: Record<string, Answer>, seen: unknown[] = []) {
  return (async (id: string, input: unknown) => {
    seen.push([id, input]);
    const answer = answers[id];
    if (!answer) throw new Error(`unexpected ${id}`);
    return answer;
  }) as unknown as Parameters<typeof g.readGuidance>[1];
}
const ID = "00000000-0000-4000-8000-0000000000aa";
const record = { id: ID, authors: [{ kind: "person", family: "Izmišljena", given: "Ana" }], year: 2015, title: "Priručnik", type: "book", place: "Zagreb", publisher: "N" };

describe("readGuidance", () => {
  it("maps sources, requests and the review mark", async () => {
    const read = await g.readGuidance("w1", fake({ "teacher.source-guidance.get": { ok: true, status: 200, body: {
      canWrite: true, literatureSeenAt: "2026-11-20T10:00:00.000Z", proofRequests: [],
      sources: [{ id: ID, record, doi: null, isbn: null, undated: false, requirement: "required", createdAt: "2026-11-01T10:00:00.000Z", updatedAt: "x", proofCount: 3 }],
    } } }));
    expect(read).toEqual({ kind: "ready", guidance: { canWrite: true, seenAt: "2026-11-20T10:00:00.000Z", requests: [],
      sources: [{ id: ID, label: "Priručnik", requirement: "required", proofCount: 3, createdAt: "2026-11-01T10:00:00.000Z" }] } });
  });
  it("maps failures", async () => {
    expect(await g.readGuidance("w1", fake({ "teacher.source-guidance.get": { ok: false, status: 401 } }))).toEqual({ kind: "signedOut" });
    expect(await g.readGuidance("w1", fake({ "teacher.source-guidance.get": { ok: false, status: 503 } }))).toEqual({ kind: "unavailable" });
    expect(await g.readGuidance("w1", fake({}))).toEqual({ kind: "unavailable" });
  });
});

describe("readProofs", () => {
  it("reads page and note of each proof", async () => {
    const seen: unknown[] = [];
    expect(await g.readProofs("w1", ID, fake({ "teacher.source-proofs.get": { ok: true, status: 200, body: { proofs: [{ id: "p", page: "4", note: null, imagePath: "/x" }] } } }, seen)))
      .toEqual({ kind: "ready", proofs: [{ id: "p", page: "4", note: null }] });
    expect(seen[0]).toEqual(["teacher.source-proofs.get", { params: { documentId: "w1", sourceId: ID }, query: undefined, body: undefined }]);
    expect(await g.readProofs("w1", ID, fake({ "teacher.source-proofs.get": { ok: false, status: 404 } }))).toEqual({ kind: "unavailable" });
  });
});

describe("writes", () => {
  it("sends the recommendation with the record id and the requirement", async () => {
    const seen: unknown[] = [];
    const draft: SourceDraft = { type: "book", authors: [{ kind: "person", family: "A", given: "B" }], title: "T", year: 2020, place: "Z", publisher: "P" };
    expect(await g.recommendSource("w1", draft, "required", ID, fake({ "teacher.source-recommendation.put": { ok: true, status: 200 } }, seen))).toBe("ok");
    expect(seen[0]).toEqual(["teacher.source-recommendation.put", { params: { documentId: "w1", sourceId: ID }, query: undefined, body: { record: { id: ID, ...draft }, requirement: "required" } }]);
  });
  it("sends the proof request and withdraws it", async () => {
    const seen: unknown[] = [];
    const call = fake({ "teacher.source-proof-request.put": { ok: true, status: 200 }, "teacher.source-proof-request.delete": { ok: true, status: 204 },
      "teacher.source-recommendation.delete": { ok: true, status: 204 }, "teacher.literature-seen.put": { ok: true, status: 200 } }, seen);
    expect(await g.requestProof("w1", ID, "Potvrdi", "2026-12-01T23:59:59.000Z", call)).toBe("ok");
    expect(seen[0]).toEqual(["teacher.source-proof-request.put", { params: { documentId: "w1", sourceId: ID }, query: undefined, body: { instruction: "Potvrdi", dueAt: "2026-12-01T23:59:59.000Z" } }]);
    expect(await g.withdrawProof("w1", ID, call)).toBe("ok");
    expect(await g.removeRecommendation("w1", ID, call)).toBe("ok");
    expect(await g.markLiteratureSeen("w1", call)).toBe("ok");
  });
  it("answers signedOut for 401 and failed for anything else, including a throw", async () => {
    expect(await g.markLiteratureSeen("w1", fake({ "teacher.literature-seen.put": { ok: false, status: 401 } }))).toBe("signedOut");
    expect(await g.markLiteratureSeen("w1", fake({ "teacher.literature-seen.put": { ok: false, status: 503 } }))).toBe("failed");
    expect(await g.markLiteratureSeen("w1", fake({}))).toBe("failed");
  });
});
