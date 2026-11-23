import type { Transform } from "@tiptap/pm/transform";
import { beforeAll, describe, expect, it, vi } from "vitest";

import type { EvidenceChainHeadV2 } from "../../packages/editor-core/src/document/forensics/evidence-chain-v2";
import {
  buildRecord,
  jcsOf,
  RECORD_DOCUMENT_ID as DOC,
  recordSchema as schema,
  sha,
  startNode as start,
  type BuiltRecord,
} from "./replay-record/replay-record.fixture";

import {
  buildRecordV3,
  citeAndFootnote,
  typeAt as typeAtV3,
  V3_START_JCS,
  v3Start,
} from "./replay-record/replay-record-v3.fixture";
import { createBrowserReplayStepsV1, createBrowserReplayStepsV3 } from "./replay-record/replay-steps";
import { buildReplayTimeline } from "./replay-record/replay-timeline";
import { REVISION_ZERO_JCS, REVISION_ZERO_NODE_ID } from "@/domain/document/revision-zero";

import {
  fetchReplayRecord,
  loadReplay,
  parseReplayPage,
  REPLAY_PAGE_FORMAT,
  REPLAY_PAGE_MAX_SEGMENTS,
  REPLAY_RESTARTS,
  replayStepsFor,
} from "./replay";

// createApi names the page's own origin; the node test has none.
beforeAll(() => { vi.stubGlobal("location", { origin: "http://localhost" }); });

const typeAt = (pos: number, value: string) => ({ edit: (tr: Transform) => void tr.insert(pos, schema.text(value)) });
const recordOf = (letters: string) =>
  buildRecord(start, [...letters].map((letter, i) => ({ at: `10:${String(i).padStart(2, "0")}`, events: [typeAt(17 + i, letter)] })));

const one = recordOf("XYZ");
const other = recordOf("QRST");

/** The page of `r` from `from` with `size` segments, as the route writes it. */
function pageOf(r: BuiltRecord, from: number, size: number, resumeDocuments: Record<string, string> = {}) {
  const count = r.segments.length;
  const segments = r.segments.slice(from, from + size);
  const end = from + segments.length;
  return {
    replayFormat: REPLAY_PAGE_FORMAT,
    segmentCount: count,
    head: r.head,
    from,
    next: end < count ? end : null,
    startDocument: from === 0 && count > 0 ? jcsOf(start) : null,
    segments,
    resumeDocuments,
  };
}
const EMPTY = { replayFormat: REPLAY_PAGE_FORMAT, segmentCount: 0, head: null, from: 0, next: null, startDocument: null, segments: [], resumeDocuments: {} };

type Reply = { status: number; body?: unknown } | "offline";
/** A fetcher that answers each request with the next reply and records every body. */
function scripted(replies: Reply[]) {
  const bodies: unknown[] = [];
  const fetcher = vi.fn<typeof fetch>(async (_input, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    const reply = replies.shift();
    if (reply === undefined) throw new Error("no more replies");
    if (reply === "offline") throw new TypeError("offline");
    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), { status: reply.status });
  });
  return { fetcher, bodies };
}
const ok = (body: unknown): Reply => ({ status: 200, body });
const changed: Reply = { status: 409, body: { error: "record_changed" } };

describe("parseReplayPage (DAN-537)", () => {
  const first = pageOf(one, 0, 2);
  const second = pageOf(one, 2, 2);
  const pin = one.head as EvidenceChainHeadV2;

  it("takes a first page, a later page pinned to the head, and the empty record", () => {
    expect(parseReplayPage(first, 0, null)).toMatchObject({ from: 0, next: 2, segments: one.segments.slice(0, 2) });
    expect(parseReplayPage(second, 2, pin)).toMatchObject({ from: 2, next: null, startDocument: null });
    expect(parseReplayPage(EMPTY, 0, null)).toMatchObject({ segmentCount: 0, head: null, segments: [] });
  });

  const rejected: [string, unknown, number, EvidenceChainHeadV2 | null][] = [
    ["not an object", [first], 0, null],
    ["an unknown field", { ...first, minute: 3 }, 0, null],
    ["a missing field", Object.fromEntries(Object.entries(first).filter(([key]) => key !== "resumeDocuments")), 0, null],
    ["another format", { ...first, replayFormat: "ductus-evidence-replay-v2" }, 0, null],
    ["another start than asked", first, 1, null],
    ["a count that is no whole number", { ...first, segmentCount: 3.5 }, 0, null],
    ["a negative count", { ...EMPTY, segmentCount: -1 }, 0, null],
    ["a head whose count is not the page's", { ...first, segmentCount: 4, next: 2 }, 0, null],
    ["a head with an extra field", { ...first, head: { ...pin, at: "x" } }, 0, null],
    ["a head hash that is not hex", { ...first, head: { ...pin, segmentHash: pin.segmentHash.toUpperCase() } }, 0, null],
    ["no head for a record with segments", { ...first, head: null }, 0, null],
    ["a head for the empty record", { ...EMPTY, head: pin }, 0, null],
    ["a later page with another head than the pin", pageOf(other, 2, 2), 2, pin],
    ["a later page with no head", { ...second, head: null, segmentCount: 0 }, 2, pin],
    ["a segment that is not text", { ...first, segments: [one.segments[0], 7] }, 0, null],
    ["more segments than a page holds", { ...first, segments: Array(REPLAY_PAGE_MAX_SEGMENTS + 1).fill("x"), next: REPLAY_PAGE_MAX_SEGMENTS + 1, segmentCount: 300, head: { ...pin, segmentCount: 300 } }, 0, null],
    ["segments past the count", { ...first, segments: [...one.segments, "x"], next: null }, 0, null],
    ["no segments on a page of a non-empty record", { ...first, segments: [], next: 0 }, 0, null],
    ["a next that is not the end of the page", { ...first, next: 3 }, 0, null],
    ["a next on the last page", { ...second, next: 3 }, 2, pin],
    ["no start document on the first page", { ...first, startDocument: null }, 0, null],
    ["a start document on a later page", { ...second, startDocument: jcsOf(start) }, 2, pin],
    ["a resume document under a key that is no hash", { ...first, resumeDocuments: { abc: "{}" } }, 0, null],
    ["a resume document that is not text", { ...first, resumeDocuments: { [sha("x")]: 1 } }, 0, null],
    ["an empty record that goes on", { ...EMPTY, next: 1 }, 0, null],
    ["an empty record with a start document", { ...EMPTY, startDocument: "{}" }, 0, null],
    ["an empty record with a resume document", { ...EMPTY, resumeDocuments: { [sha("x")]: "{}" } }, 0, null],
  ];
  it.each(rejected)("rejects %s", (_name, value, from, pinned) => {
    expect(parseReplayPage(value, from, pinned)).toBeNull();
  });
});

describe("fetchReplayRecord (DAN-537)", () => {
  it("joins the pages of one record, and every page after the first names the pinned head", async () => {
    const { fetcher, bodies } = scripted([ok(pageOf(one, 0, 1)), ok(pageOf(one, 1, 1)), ok(pageOf(one, 2, 1))]);
    const read = await fetchReplayRecord(DOC, () => true, fetcher);
    expect(read).toStrictEqual({ kind: "ok", record: { startDocument: jcsOf(start), segments: one.segments, head: one.head, resumeDocuments: {} } });
    expect(bodies).toStrictEqual([
      { documentId: DOC, from: 0 },
      { documentId: DOC, from: 1, head: one.head },
      { documentId: DOC, from: 2, head: one.head },
    ]);
    const init = fetcher.mock.calls[0][1];
    expect([String(fetcher.mock.calls[0][0]), init?.method, init?.credentials, init?.cache])
      .toStrictEqual(["http://localhost/api/v1/evidence/replay", "POST", "same-origin", "no-store"]);
    expect((init?.headers as Record<string, string>)["ductus-protocol"]).toBe("1");
  });

  it("reads the empty record in one request", async () => {
    const { fetcher } = scripted([ok(EMPTY)]);
    expect(await fetchReplayRecord(DOC, () => true, fetcher)).toStrictEqual({
      kind: "ok",
      record: { startDocument: null, segments: [], head: null, resumeDocuments: {} },
    });
  });

  it.each([
    [401, "signedOut"],
    [404, "notFound"],
    [503, "unavailable"],
    [500, "unavailable"],
    [204, "unavailable"],
  ] as const)("maps HTTP %i to %s", async (status, kind) => {
    const { fetcher } = scripted([{ status, body: { error: "x" } }]);
    expect(await fetchReplayRecord(DOC, () => true, fetcher)).toStrictEqual({ kind });
  });

  it("is unavailable when the network fails, or the body is not UTF-8 JSON", async () => {
    expect(await fetchReplayRecord(DOC, () => true, scripted(["offline"]).fetcher)).toStrictEqual({ kind: "unavailable" });
    const bytes = vi.fn<typeof fetch>(async () => new Response(new Uint8Array([0x7b, 0xff, 0x7d]), { status: 200 }));
    expect(await fetchReplayRecord(DOC, () => true, bytes)).toStrictEqual({ kind: "unavailable" });
  });

  it("sends nothing once the session has ended, also between pages", async () => {
    const { fetcher } = scripted([ok(pageOf(one, 0, 1))]);
    expect(await fetchReplayRecord(DOC, () => false, fetcher)).toStrictEqual({ kind: "signedOut" });
    expect(fetcher).not.toHaveBeenCalled();
    let left = 1;
    expect(await fetchReplayRecord(DOC, () => left-- > 0, fetcher)).toStrictEqual({ kind: "signedOut" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("after a 409 on the second page starts again and shows only the new record", async () => {
    const { fetcher, bodies } = scripted([ok(pageOf(one, 0, 2)), changed, ok(pageOf(other, 0, 3)), ok(pageOf(other, 3, 3))]);
    const read = await fetchReplayRecord(DOC, () => true, fetcher);
    expect(read).toStrictEqual({ kind: "ok", record: { startDocument: jcsOf(start), segments: other.segments, head: other.head, resumeDocuments: {} } });
    // The fresh reading asks without a head, then pins the new one.
    expect(bodies.slice(2)).toStrictEqual([{ documentId: DOC, from: 0 }, { documentId: DOC, from: 3, head: other.head }]);
    if (read.kind === "ok") for (const segment of one.segments) expect(read.record.segments).not.toContain(segment);
  });

  it(`is unavailable after ${REPLAY_RESTARTS + 1} readings that each end in a 409`, async () => {
    const replies: Reply[] = [];
    for (let i = 0; i <= REPLAY_RESTARTS; i++) replies.push(ok(pageOf(one, 0, 1)), changed);
    const { fetcher } = scripted(replies);
    expect(await fetchReplayRecord(DOC, () => true, fetcher)).toStrictEqual({ kind: "unavailable" });
    expect(fetcher).toHaveBeenCalledTimes(2 * (REPLAY_RESTARTS + 1));
  });

  it("rejects a 200 page whose head is not the pinned one, and never joins two records", async () => {
    const { fetcher } = scripted([ok(pageOf(one, 0, 2)), ok({ ...pageOf(other, 2, 2), next: null, segmentCount: 4 })]);
    expect(await fetchReplayRecord(DOC, () => true, fetcher)).toStrictEqual({ kind: "unavailable" });
  });

  it("joins the resume documents of the pages, and refuses two texts for one hash", async () => {
    const hash = sha("{\"a\":1}");
    const same = scripted([ok(pageOf(one, 0, 2, { [hash]: "{\"a\":1}" })), ok(pageOf(one, 2, 1, { [hash]: "{\"a\":1}" }))]);
    const joined = await fetchReplayRecord(DOC, () => true, same.fetcher);
    expect(joined.kind === "ok" && joined.record.resumeDocuments).toStrictEqual({ [hash]: "{\"a\":1}" });

    const clash = scripted([ok(pageOf(one, 0, 2, { [hash]: "{\"a\":1}" })), ok(pageOf(one, 2, 1, { [hash]: "{\"a\":2}" }))]);
    expect(await fetchReplayRecord(DOC, () => true, clash.fetcher)).toStrictEqual({ kind: "unavailable" });
  });
});

describe("loadReplay (DAN-537)", () => {
  it("replays a record read over pages, with no input about who looks", async () => {
    const { fetcher } = scripted([ok(pageOf(one, 0, 2)), ok(pageOf(one, 2, 2))]);
    const loaded = await loadReplay(DOC, () => true, fetcher);
    if (loaded.kind !== "ok") throw new Error(loaded.kind);
    expect(loaded.player.total).toBe(3);
    expect(loaded.player.documentAt(3)).toStrictEqual(one.ends[2].toJSON());
    expect(loadReplay.length).toBe(1);
  });

  it("is unavailable, never partly shown, when the record fails a check", async () => {
    const tampered = { ...pageOf(one, 0, 3), segments: [one.segments[0], one.segments[1].replace("\"Y\"", "\"W\""), one.segments[2]] };
    expect(await loadReplay(DOC, () => true, scripted([ok(tampered)]).fetcher)).toStrictEqual({ kind: "unavailable" });
  });

  it("passes signed out and not found through", async () => {
    expect(await loadReplay(DOC, () => true, scripted([{ status: 401 }]).fetcher)).toStrictEqual({ kind: "signedOut" });
    expect(await loadReplay(DOC, () => true, scripted([{ status: 404 }]).fetcher)).toStrictEqual({ kind: "notFound" });
  });
});

describe("replay of a work of document v3 (INT-23)", () => {
  type V3Record = Awaited<ReturnType<typeof buildRecordV3>>;
  // Sources, a citation and a footnote, then text typed after them, in two segments.
  let v3: V3Record;
  beforeAll(async () => {
    v3 = await buildRecordV3([[citeAndFootnote, typeAtV3(3, " Izmišljena")], [typeAtV3(14, " rečenica.")]]);
  });

  /** The page of the v3 record from `from` with `size` segments, as the route writes it. */
  function pageV3(r: V3Record, from: number, size: number, startDocument = V3_START_JCS) {
    const segments = r.segments.slice(from, from + size);
    const end = from + segments.length;
    return {
      replayFormat: REPLAY_PAGE_FORMAT,
      segmentCount: r.segments.length,
      head: r.head,
      from,
      next: end < r.segments.length ? end : null,
      startDocument: from === 0 ? startDocument : null,
      segments,
      resumeDocuments: {},
    };
  }
  const recordV3 = (r: V3Record, startDocument = V3_START_JCS) =>
    ({ startDocument, segments: r.segments, head: r.head, resumeDocuments: {}, sessionBreakAboveMinutes: 30 });

  it("the record is written in ductus-edit-steps-v3 from the v3 revision 0", () => {
    const first = JSON.parse(v3.segments[0]!) as { captureContext: { transactionFormat: string } };
    expect(first.captureContext.transactionFormat).toBe("ductus-edit-steps-v3");
    expect(v3.segments).toHaveLength(2);
  });

  it("goes through the whole timeline: every step, no gap, the document of every event's hash", async () => {
    const timeline = await buildReplayTimeline(recordV3(v3), createBrowserReplayStepsV3());
    if (!timeline.ok) throw new Error(timeline.reason);
    expect(timeline.end).toBe("complete");
    // The record starts at the v3 revision 0 with event 1: nothing before it is missing.
    expect(timeline.markers.filter((marker) => marker.kind === "gap")).toStrictEqual([]);
    expect(timeline.changes.map((change) => change.kind)).toStrictEqual(["structure", "insert", "insert", "insert", "insert"]);
    expect(timeline.changes.map((change) => change.index)).toStrictEqual([1, 2, 3, 4, 5]);
    expect(timeline.documentAt(0)).toStrictEqual(v3Start.toJSON());
    expect(timeline.documentAt(timeline.changes.length)).toStrictEqual(v3.ends[1]!.toJSON());
    const history = timeline.blockHistory(REVISION_ZERO_NODE_ID);
    expect(history.at(-1)).toMatchObject({ after: " Izmišljena rečenica.", inserted: " rečenica." });
  });

  it("loadReplay reads the v3 record over pages and replays it with the v3 replayer", async () => {
    const { fetcher } = scripted([ok(pageV3(v3, 0, 1)), ok(pageV3(v3, 1, 1))]);
    const loaded = await loadReplay(DOC, () => true, fetcher);
    if (loaded.kind !== "ok") throw new Error(loaded.kind);
    expect(loaded.player.end).toBe("complete");
    expect(loaded.player.total).toBe(5);
    expect(loaded.player.entries.some((entry) => entry.entry === "gap")).toBe(false);
    expect(loaded.player.documentAt(5)).toStrictEqual(v3.ends[1]!.toJSON());
    expect(loaded.player.paragraphHistory(REVISION_ZERO_NODE_ID).at(-1)).toMatchObject({ entry: "change", index: 5 });
  });

  it("picks the replayer by the step format of the first segment", () => {
    expect(replayStepsFor({ segments: v3.segments })?.transactionFormat).toBe("ductus-edit-steps-v3");
    expect(replayStepsFor({ segments: one.segments })?.transactionFormat).toBe("ductus-edit-steps-v1");
    // The empty record is read as before.
    expect(replayStepsFor({ segments: [] })?.transactionFormat).toBe("ductus-edit-steps-v1");
  });

  it("knows no other step format: unknown, missing or unreadable is no replayer", () => {
    const other = (format: unknown) => {
      const segment = JSON.parse(v3.segments[0]!) as { captureContext: Record<string, unknown> };
      segment.captureContext.transactionFormat = format;
      return JSON.stringify(segment);
    };
    for (const format of ["ductus-edit-steps-v2", "ductus-edit-steps-v4", "ductus-edit-steps-v9", "", 3, null]) {
      expect(replayStepsFor({ segments: [other(format)] })).toBeNull();
    }
    expect(replayStepsFor({ segments: ["{"] })).toBeNull();
    expect(replayStepsFor({ segments: ["[]"] })).toBeNull();
    expect(replayStepsFor({ segments: [JSON.stringify({ captureContext: null })] })).toBeNull();
  });

  it("is unavailable for a record of an unknown step format, even with a whole chain", async () => {
    const segment = JSON.parse(v3.segments[0]!) as { captureContext: Record<string, unknown> };
    segment.captureContext.transactionFormat = "ductus-edit-steps-v9";
    const text = JSON.stringify(segment);
    const page = { ...pageV3(v3, 0, 1), segmentCount: 1, next: null, segments: [text], head: { segmentHash: sha(text), segmentCount: 1 } };
    expect(await loadReplay(DOC, () => true, scripted([ok(page)]).fetcher)).toStrictEqual({ kind: "unavailable" });
  });

  it("stays fail-closed: a changed v3 segment, or a start document of another schema", async () => {
    const tampered = { ...pageV3(v3, 0, 2), segments: [v3.segments[0], v3.segments[1]!.replace("rečenica", "recenica")] };
    expect(await loadReplay(DOC, () => true, scripted([ok(tampered)]).fetcher)).toStrictEqual({ kind: "unavailable" });
    const v1Start = pageV3(v3, 0, 2, REVISION_ZERO_JCS);
    expect(await loadReplay(DOC, () => true, scripted([ok(v1Start)]).fetcher)).toStrictEqual({ kind: "unavailable" });
    expect(await buildReplayTimeline(recordV3(v3, REVISION_ZERO_JCS), createBrowserReplayStepsV3()))
      .toStrictEqual({ ok: false, reason: "document_mismatch" });
    // The v3 revision 0 under the wrong hash is no start either.
    expect(await buildReplayTimeline(recordV3(v3, V3_START_JCS.replace("[]}", "[] }")), createBrowserReplayStepsV3()))
      .toStrictEqual({ ok: false, reason: "document_mismatch" });
  });

  it("each replayer refuses the other's format: v3 is never read as v1, nor v1 as v3", async () => {
    // Each segment is checked against the replayer's own format, so it is no segment of the other.
    expect(await buildReplayTimeline(recordV3(v3), createBrowserReplayStepsV1()))
      .toStrictEqual({ ok: false, reason: "invalid_segment" });
    const v1 = { startDocument: jcsOf(start), segments: one.segments, head: one.head, resumeDocuments: {}, sessionBreakAboveMinutes: 30 };
    expect(await buildReplayTimeline(v1, createBrowserReplayStepsV3())).toStrictEqual({ ok: false, reason: "invalid_segment" });
  });
});
