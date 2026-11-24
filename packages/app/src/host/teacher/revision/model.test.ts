import { describe, expect, it } from "vitest";
import type { RevisionRequest } from "@/client/revision-requests";
import { acceptBody, bannerOf, buildRevision, reopenBody, withdrawBody } from "./model";
import { revisionMessages as t } from "./messages.hr";

const anchor = { nodeId: "n", quote: "q", prefix: "", suffix: "", startHint: 0, endHint: 1 };
const version = (extra: object = {}) => ({
  version: 1, instruction: "Dopunite izvor.", requestedRevision: 4, openedIsOwn: true, openedWindow: "2026-11-05T20:40:00.000Z",
  response: null, closed: null, ...extra,
});
const request = (state: RevisionRequest["state"], v = version()): RevisionRequest =>
  ({ id: "0b6c7f1e-1111-4222-8333-444455556666", number: 1, state, rowSeq: 3, anchor, versions: [v] }) as unknown as RevisionRequest;
const answered = version({ response: { kind: "done", explanation: "Dopunjeno.", revision: 9, isOwn: false, window: "2026-11-06T09:00:00.000Z" } });

describe("dd-h form", () => {
  it("needs a text and a mandatory deadline", () => {
    expect(buildRevision({ instruction: "  ", due: "2026-11-30", today: "2026-11-22" })).toEqual({ ok: false, error: "emptyInstruction" });
    expect(buildRevision({ instruction: "Dopunite izvor.", due: "", today: "2026-11-22" })).toEqual({ ok: false, error: "dueRequired" });
    expect(buildRevision({ instruction: "Dopunite izvor.", due: "2026-11-21", today: "2026-11-22" })).toEqual({ ok: false, error: "pastDue" });
    expect(buildRevision({ instruction: "x".repeat(2001), due: "2026-11-30", today: "2026-11-22" })).toEqual({ ok: false, error: "tooLong" });
  });
  it("the deadline is the end of the chosen day in Zagreb time", () => {
    expect(buildRevision({ instruction: "Dopunite izvor.", due: "2026-11-30", today: "2026-11-22" }))
      .toEqual({ ok: true, body: { instruction: "Dopunite izvor.", dueAt: "2026-11-30T22:59:00.000Z" } });
  });
});

describe("doradaBanner", () => {
  it("has no banner without a request or when it was withdrawn", () => {
    expect(bannerOf([])).toBeNull();
    expect(bannerOf([request("withdrawn")])).toBeNull();
  });
  it("names the four states; accept and reopen only after the student answered", () => {
    expect(bannerOf([request("open")])).toMatchObject({ state: "open", canClose: false, head: t.stateHead("otvoren", "5. 11. 2026. u 21:40") });
    expect(bannerOf([request("responded", answered)])).toMatchObject({ state: "responded", canClose: true });
    expect(bannerOf([request("responded", answered)])?.head).toContain("student navodi da je proveden");
    expect(bannerOf([request("accepted", answered)])).toMatchObject({ canClose: false });
    expect(bannerOf([request("reopened")])?.head).toContain("ponovno otvoren");
  });
  it("accept and reopen bodies carry the counter and the answered revision, only once answered", () => {
    expect(acceptBody(request("responded", answered))).toMatchObject({ expectedSeq: 3, acceptedRevision: 9, acceptedAnchor: null, rangeHash: null });
    expect(reopenBody(request("responded", answered))).toMatchObject({ expectedSeq: 3, requestedRevision: 9, instruction: "Dopunite izvor." });
    expect(acceptBody(request("open"))).toBeNull();
    expect(reopenBody(request("open"))).toBeNull();
  });
});

describe("Povuci zahtjev", () => {
  it("is offered only while the student has not answered", () => {
    expect(bannerOf([request("open")])?.canWithdraw).toBe(true);
    expect(bannerOf([request("reopened")])?.canWithdraw).toBe(true);
    expect(bannerOf([request("responded", answered)])?.canWithdraw).toBe(false);
    expect(bannerOf([request("accepted", answered)])?.canWithdraw).toBe(false);
  });
  it("withdraw body carries only the request and the counter", () => {
    expect(withdrawBody(request("open"))).toEqual({ requestId: "0b6c7f1e-1111-4222-8333-444455556666", expectedSeq: 3 });
  });
});
