import { describe, expect, it, vi } from "vitest";

import { fetchProcessSummary, type ProcessSummaryV1 } from "./process-summary";

// WEB-34: ported from Ductus src/client/process-summary.test.ts at 0cdb0f1.
// The read now goes through createApi (projection.process-summary.post), so
// the contract's closed schema and summaryAgrees together refuse what
// parseProcessSummaryV1 refused; every broken summary is sent as a 200 body.
const ORIGIN = "https://ductura.test";
const read = (current: () => boolean, fetchImpl: typeof fetch) => fetchProcessSummary(DOC, current, { fetchImpl, baseUrl: ORIGIN });

// Invented summary of an invented work: two sessions, one listed paste, one gap.
function summary(): ProcessSummaryV1 {
  return {
    summaryFormat: "ductus-process-summary-v1",
    sessions: {
      evidenceKind: "observed",
      breakAboveMinutes: 30,
      count: 2,
      items: [
        { from: "2026-10-19T08:00:00.000Z", to: "2026-10-19T08:41:00.000Z" },
        { from: "2026-10-19T12:05:00.000Z", to: "2026-10-19T12:20:00.000Z" },
      ],
    },
    pastes: {
      evidenceKind: "observed",
      listedAboveCharacters: 200,
      listed: [{ at: { from: "2026-10-19T08:10:00.000Z", to: "2026-10-19T08:11:00.000Z" }, characters: 412, origin: "not_observed" }],
      smallerCount: 3,
    },
    gaps: {
      evidenceKind: "observed",
      items: [{ previousEndedAt: "2026-10-19T08:41:00.000Z", nextStartedAt: "2026-10-19T12:05:00.000Z" }],
    },
    recordState: "has_gaps",
  };
}

const DOC = "11111111-2222-4333-8444-555555555555";

function reply(status: number, body?: string | Uint8Array) {
  return vi.fn<typeof fetch>(async () => new Response(status === 204 ? null : ((body ?? "{}") as BodyInit), {
    status, headers: status === 204 ? {} : { "content-type": "application/json" },
  }));
}
const send = (value: unknown) => read(() => true, reply(200, JSON.stringify(value)));

describe("the summary shown", () => {
  it("accepts exactly the summary the route returns and keeps its order", async () => {
    expect(await send(summary())).toEqual({ kind: "ok", summary: summary() });
    const complete = summary();
    complete.gaps.items = [];
    complete.recordState = "complete";
    expect(await send(complete)).toMatchObject({ kind: "ok", summary: { recordState: "complete" } });
  });

  // Object.assign writes values the type does not allow, as a hostile server would.
  const broken: [string, (s: ProcessSummaryV1) => void][] = [
    ["an extra top-level key, such as a role", (s) => { Object.assign(s, { viewerRole: "teacher" }); }],
    ["an extra nested key", (s) => { Object.assign(s.pastes, { share: 0.4 }); }],
    ["an extra key in a list item", (s) => { Object.assign(s.pastes.listed[0]!, { source: "web" }); }],
    ["a missing key", (s) => { delete (s as Partial<ProcessSummaryV1>).gaps; }],
    ["another format", (s) => { Object.assign(s, { summaryFormat: "ductus-process-summary-v2" }); }],
    ["another kind of evidence", (s) => { Object.assign(s.sessions, { evidenceKind: "declared" }); }],
    ["a count that is not the list length", (s) => { s.sessions.count = 3; }],
    ["a time that is not a whole minute", (s) => { s.sessions.items[0]!.from = "2026-10-19T08:00:30.000Z"; }],
    ["a time in another zone", (s) => { s.sessions.items[0]!.from = "2026-10-19T10:00:00.000+02:00"; }],
    ["a span that ends before it starts", (s) => { s.sessions.items[1] = { from: "2026-10-19T12:20:00.000Z", to: "2026-10-19T12:05:00.000Z" }; }],
    ["a gap that ends before it starts", (s) => { s.gaps.items[0] = { previousEndedAt: "2026-10-19T12:05:00.000Z", nextStartedAt: "2026-10-19T08:41:00.000Z" }; }],
    ["a listed paste at or under P-02", (s) => { s.pastes.listed[0]!.characters = 200; }],
    ["a paste with an observed origin", (s) => { Object.assign(s.pastes.listed[0]!, { origin: "web" }); }],
    ["a fraction", (s) => { s.pastes.smallerCount = 1.5; }],
    ["a negative count", (s) => { s.pastes.smallerCount = -1; }],
    ["a number as text", (s) => { Object.assign(s.sessions, { breakAboveMinutes: "30" }); }],
    ["P-01 of zero", (s) => { s.sessions.breakAboveMinutes = 0; }],
    ["a complete record with gaps", (s) => { s.recordState = "complete"; }],
    ["gaps claimed with none listed", (s) => { s.gaps.items = []; }],
    ["an unknown record state", (s) => { Object.assign(s, { recordState: "verified" }); }],
    ["a list that is not an array", (s) => { Object.assign(s.gaps, { items: {} }); }],
  ];
  it.each(broken)("refuses %s", async (_name, change) => {
    const s = summary();
    change(s);
    expect(await send(s)).toEqual({ kind: "unavailable" });
  });

  it("refuses values that are not a summary object", async () => {
    for (const value of [null, [], "summary", 1, [summary()]]) expect(await send(value)).toEqual({ kind: "unavailable" });
  });
});

describe("fetchProcessSummary", () => {
  it("sends only the document id, by POST with the session cookie", async () => {
    const fetcher = reply(200, JSON.stringify(summary()));
    expect(await read(() => true, fetcher)).toEqual({ kind: "ok", summary: summary() });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe(`${ORIGIN}/api/v1/process-summary`);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ documentId: DOC });
  });

  it("sends nothing once the session has ended here", async () => {
    const fetcher = reply(200, JSON.stringify(summary()));
    expect(await read(() => false, fetcher)).toEqual({ kind: "signedOut" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    [401, "signedOut"],
    [404, "notFound"],
    [400, "unavailable"],
    [415, "unavailable"],
    [422, "unavailable"],
    [503, "unavailable"],
    [500, "unavailable"],
    [204, "unavailable"],
    [302, "unavailable"],
  ])("answers %i as %s", async (status, kind) => {
    expect(await read(() => true, reply(status, '{"error":"x"}'))).toEqual({ kind });
  });

  it("never shows a 200 body that is not a valid summary", async () => {
    const extra = { ...summary(), role: "student" };
    for (const body of ["", "not json", JSON.stringify(extra), new Uint8Array([0x7b, 0xff, 0x7d])]) {
      expect(await read(() => true, reply(200, body))).toEqual({ kind: "unavailable" });
    }
  });

  it("answers a network failure as unavailable", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => { throw new TypeError("offline"); });
    expect(await read(() => true, fetcher)).toEqual({ kind: "unavailable" });
  });
});
